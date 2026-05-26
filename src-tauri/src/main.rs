pub mod telemetry;

use std::io::Write;
use std::path::PathBuf;
use std::sync::Mutex;
use tokio::sync::broadcast;
use tauri::Emitter;

use telemetry::watcher::{spawn_async_watcher, Orchestrator};
use telemetry::types::{AgentContextPayload, FileCategory};
use portable_pty::{native_pty_system, CommandBuilder, PtySize, MasterPty};

/// Dynamic compile-time safe selection of default shell executable
#[cfg(target_os = "windows")]
fn create_shell_command() -> CommandBuilder {
    let mut cmd = CommandBuilder::new("powershell.exe");
    cmd.args(&["-ExecutionPolicy", "Bypass", "-NoProfile", "-NonInteractive", "-NoLogo"]);
    cmd
}

#[cfg(not(target_os = "windows"))]
fn create_shell_command() -> CommandBuilder {
    CommandBuilder::new("bash")
}

pub struct PtySession {
    pub writer: Box<dyn std::io::Write + Send>,
    pub master: Box<dyn MasterPty + Send + Sync>,
}

pub struct AppState {
    pub active_file: Mutex<Option<PathBuf>>,
    pub pty_session: Mutex<Option<PtySession>>,
}

#[tauri::command]
async fn load_file_content(
    path: String,
    state: tauri::State<'_, AppState>,
) -> Result<String, String> {
    let path_buf = PathBuf::from(&path);
    match tokio::fs::read_to_string(&path_buf).await {
        Ok(content) => {
            let mut active = state.active_file.lock().map_err(|e| e.to_string())?;
            *active = Some(path_buf);
            Ok(content)
        }
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
async fn save_file_content(
    content: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let active = state.active_file.lock().map_err(|e| e.to_string())?;
    if let Some(path) = &*active {
        tokio::fs::write(path, content).await.map_err(|e| e.to_string())?;
        Ok(())
    } else {
        Err("No active note/code workspace loaded to save".to_string())
    }
}

#[tauri::command]
async fn get_workspace_files() -> Result<Vec<String>, String> {
    let mut files = Vec::new();
    let lectures_dir = std::path::Path::new("d:/Calyx Scholar/01-Lectures");
    let assessments_dir = std::path::Path::new("d:/Calyx Scholar/03-Assessments");

    // Ensure directories exist asynchronously
    tokio::fs::create_dir_all(lectures_dir).await.map_err(|e| e.to_string())?;
    tokio::fs::create_dir_all(assessments_dir).await.map_err(|e| e.to_string())?;

    // Read 01-Lectures asynchronously
    if let Ok(mut read_dir) = tokio::fs::read_dir(lectures_dir).await {
        while let Ok(Some(entry)) = read_dir.next_entry().await {
            let path = entry.path();
            if path.is_file() {
                files.push(path.to_string_lossy().into_owned().replace("\\", "/"));
            }
        }
    }

    // Read 03-Assessments asynchronously
    if let Ok(mut read_dir) = tokio::fs::read_dir(assessments_dir).await {
        while let Ok(Some(entry)) = read_dir.next_entry().await {
            let path = entry.path();
            if path.is_file() {
                files.push(path.to_string_lossy().into_owned().replace("\\", "/"));
            }
        }
    }

    // If completely empty, automatically copy default placeholder lecture note asynchronously
    if files.is_empty() {
        let template_path = std::path::Path::new("d:/Calyx Scholar/.tutor-core/templates/lecture_template.md");
        let default_note_path = lectures_dir.join("lecture1.md");
        if template_path.exists() {
            if let Ok(template_content) = tokio::fs::read_to_string(template_path).await {
                if tokio::fs::write(&default_note_path, template_content).await.is_ok() {
                    files.push(default_note_path.to_string_lossy().into_owned().replace("\\", "/"));
                }
            }
        }
    }

    Ok(files)
}

#[tauri::command]
async fn spawn_pty(
    app_handle: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let mut session_guard = state.pty_session.lock().map_err(|e| e.to_string())?;
    if session_guard.is_some() {
        return Ok(());
    }

    let pty_system = native_pty_system();
    let pair = pty_system
        .openpty(PtySize {
            rows: 24,
            cols: 80,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| e.to_string())?;

    let cmd = create_shell_command();
    let _child = pair.slave.spawn_command(cmd).map_err(|e| e.to_string())?;

    let writer = pair.master.take_writer().map_err(|e| e.to_string())?;
    let mut reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;

    // Asynchronously stream stdout outputs directly into React viewport PTY handlers
    let app_handle_clone = app_handle.clone();
    tokio::spawn(async move {
        let mut buffer = [0u8; 1024];
        loop {
            match reader.read(&mut buffer) {
                Ok(0) => break,
                Ok(n) => {
                    let text = String::from_utf8_lossy(&buffer[0..n]).to_string();
                    let _ = app_handle_clone.emit("terminal-stdout", text);
                }
                Err(_) => break,
            }
        }
    });

    *session_guard = Some(PtySession {
        writer,
        master: pair.master,
    });

    Ok(())
}

#[tauri::command]
async fn write_to_pty(
    data: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let mut session_guard = state.pty_session.lock().map_err(|e| e.to_string())?;
    if let Some(session) = &mut *session_guard {
        session
            .writer
            .write_all(data.as_bytes())
            .map_err(|e| e.to_string())?;
        session.writer.flush().map_err(|e| e.to_string())?;
        Ok(())
    } else {
        Err("No active PTY session".to_string())
    }
}

#[tauri::command]
async fn resize_pty(
    cols: u16,
    rows: u16,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let session_guard = state.pty_session.lock().map_err(|e| e.to_string())?;
    if let Some(session) = &*session_guard {
        session
            .master
            .resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| e.to_string())?;
        Ok(())
    } else {
        Err("No active PTY session".to_string())
    }
}

fn main() {
    println!("Calyx Scholar Backend Initiating...");

    let workspace_root = PathBuf::from("d:/Calyx Scholar");

    // Initialize Watcher (spawns inner raw processing thread and returns WorkspaceEvent channel)
    let (mut watcher, event_rx) = spawn_async_watcher(workspace_root.clone()).expect("Failed to spawn notify watcher");
    
    // Initialize Agent Broadcast Network
    let (agent_tx, mut agent_rx) = broadcast::channel(100);

    // Watch workspace root recursively
    watcher.watch(&workspace_root, notify::RecursiveMode::Recursive)
        .expect("Failed to register workspace path to watcher");

    println!("Watching workspace root: {:?}", workspace_root);

    // Spawn Socratic Agent listener and debounced IPC broadcaster
    let agent_tx_clone = agent_tx.clone();
    tokio::spawn(async move {
        Orchestrator::start_watcher(event_rx, agent_tx_clone).await;
    });

    tauri::Builder::default()
        .manage(AppState {
            active_file: Mutex::new(None),
            pty_session: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            load_file_content,
            save_file_content,
            get_workspace_files,
            spawn_pty,
            write_to_pty,
            resize_pty
        ])
        .setup(move |app| {
            let app_handle = app.handle().clone();
            
            // Asynchronously broadcase compiled telemetry ASTs to tauri viewport
            tokio::spawn(async move {
                while let Ok(payload) = agent_rx.recv().await {
                    let _ = app_handle.emit("cs-scholar-telemetry", payload.clone());

                    // Spawn the Socratic Agent response generator
                    let app_handle_socratic = app_handle.clone();
                    tokio::spawn(async move {
                        let socratic_text = if let Some(fault) = &payload.fault_vector {
                            format!(
                                "I noticed a structural syntax anomaly in your workspace code: '{}' on line {}.\n\n\
                                If we look closely at this expression, how does it align with our active weekly syllabus boundaries? \n\
                                What can we discover to refine the AST structure and fulfill validation requirements?",
                                fault.message, fault.line_number
                            )
                        } else if payload.event.category == FileCategory::Note {
                            format!(
                                "I intercepted an update to your note: '{}'.\n\n\
                                As we trace the rules of static logic this week, what key principles are we implementing \n\
                                to maintain our state machine local and corruption-free?",
                                payload.event.relative_path
                            )
                        } else {
                            return; // Ignore other categories
                        };

                        // Reset streaming nodes
                        let _ = app_handle_socratic.emit("socratic-token-chunk", "");

                        // Initialize the Ollama client stream
                        let mut inference_stream = crate::telemetry::inference::SocraticInferenceStream::new(payload.prohibited_tokens.clone());
                        let app_handle_chunk = app_handle_socratic.clone();
                        let app_handle_err = app_handle_socratic.clone();
                        
                        let prompt = socratic_text.clone();
                        
                        // Try calling the local model server first
                        let result = inference_stream.stream_inference(&prompt, move |chunk| {
                            let _ = app_handle_chunk.emit("socratic-token-chunk", chunk.to_string());
                        }).await;

                        if let Err(e) = result {
                            eprintln!("[Socratic] Inference server offline or error: {}", e);
                            if e.contains("Breach intercepted") {
                                let _ = app_handle_err.emit("socratic-violation", format!("Socratic stream halted. Breach intercepted by zero-heap filter."));
                                return;
                            }

                            // Secure Fallback: Run local simulation characters matching rules
                            let mut filter = crate::telemetry::guardrail::SocraticFilter::new(payload.prohibited_tokens.clone());
                            for char in socratic_text.chars() {
                                let byte = char as u8;
                                if !filter.feed_byte(byte) {
                                    let _ = app_handle_err.emit("socratic-violation", format!("Socratic stream halted. Breach intercepted by zero-heap filter."));
                                    return;
                                }
                                let _ = app_handle_err.emit("socratic-token-chunk", char.to_string());
                                tokio::time::sleep(tokio::time::Duration::from_millis(15)).await;
                            }
                        }
                    });
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
