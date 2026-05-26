use notify::{Config, RecommendedWatcher, Watcher};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::sync::{broadcast, mpsc};
use tokio::time::{sleep, Duration, Instant};

use crate::telemetry::parser::StaticASTParser;
use crate::telemetry::types::{AgentContextPayload, FileCategory, WorkspaceEvent};

#[derive(serde::Deserialize)]
struct ManifestCriteria {
    prohibited_keywords: Vec<String>,
}

#[derive(serde::Deserialize)]
struct ManifestWeek {
    week: usize,
    validation_criteria: ManifestCriteria,
}

#[derive(serde::Deserialize)]
struct Manifest {
    course_id: String,
    weeks: Vec<ManifestWeek>,
}

pub struct EventBatch {
    pub events: Vec<WorkspaceEvent>,
}

/// Spawns a native file watcher, returning the recommended watcher handle
/// and a tokio mpsc receiver for processed WorkspaceEvent objects.
pub fn spawn_async_watcher(
    workspace_root: PathBuf,
) -> notify::Result<(RecommendedWatcher, mpsc::Receiver<WorkspaceEvent>)> {
    let (raw_tx, mut raw_rx) = mpsc::channel::<notify::Result<notify::Event>>(100);
    let (event_tx, event_rx) = mpsc::channel::<WorkspaceEvent>(100);

    // Tauri/Tokio event routing callback helper
    let rt = tokio::runtime::Handle::current();
    let watcher = RecommendedWatcher::new(
        move |res| {
            let raw_tx = raw_tx.clone();
            rt.spawn(async move {
                let _ = raw_tx.send(res).await;
            });
        },
        Config::default(),
    )?;

    // Spawn a background task to process raw notify events into WorkspaceEvents
    tokio::spawn(async move {
        while let Some(res) = raw_rx.recv().await {
            match res {
                Ok(raw_event) => {
                    if let Some(event) = process_raw_event(raw_event, &workspace_root) {
                        let _ = event_tx.send(event).await;
                    }
                }
                Err(e) => {
                    eprintln!("[Watcher] Raw OS event stream error: {:?}", e);
                }
            }
        }
    });

    Ok((watcher, event_rx))
}

/// Categorizes and processes raw events from the filesystem watcher.
/// Resolves path structures and ignores irrelevant edits.
fn process_raw_event(raw_event: notify::Event, workspace_root: &Path) -> Option<WorkspaceEvent> {
    // Only capture actions indicating file creation or modification
    if !raw_event.kind.is_modify() && !raw_event.kind.is_create() {
        return None;
    }

    let file_path = raw_event.paths.first()?.clone();

    // Canonicalize path relative to workspace root
    let relative_path = file_path
        .strip_prefix(workspace_root)
        .ok()?
        .to_string_lossy()
        .into_owned()
        .replace("\\", "/");

    // Ignore events in the hidden system folder (.tutor-core) or build artifacts
    if relative_path.starts_with(".tutor-core") || relative_path.starts_with("src-tauri") || relative_path.contains(".git") {
        return None;
    }

    // Map path criteria to logical categories
    let category = if relative_path.starts_with("01-Lectures/") && relative_path.ends_with(".md") {
        FileCategory::Note
    } else if relative_path.starts_with("03-Assessments/") && relative_path.ends_with(".md") {
        FileCategory::Assessment
    } else {
        match file_path.extension().and_then(|ext| ext.to_str()) {
            Some("c") | Some("py") | Some("sql") => FileCategory::SourceCode,
            _ => FileCategory::Unknown,
        }
    };

    // Filter out unknown categories
    if category == FileCategory::Unknown {
        return None;
    }

    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64;

    Some(WorkspaceEvent {
        timestamp,
        file_path,
        category,
        relative_path,
    })
}

pub struct Orchestrator {
    agent_tx: broadcast::Sender<AgentContextPayload>,
}

impl Orchestrator {
    pub fn new(agent_tx: broadcast::Sender<AgentContextPayload>) -> Self {
        Self { agent_tx }
    }

    pub async fn start_watcher(
        mut rx: mpsc::Receiver<WorkspaceEvent>,
        agent_tx: broadcast::Sender<AgentContextPayload>,
    ) {
        let mut buffer: Vec<WorkspaceEvent> = Vec::new();
        let delay = sleep(Duration::from_millis(500));
        tokio::pin!(delay);
        let mut pending_change = false;

        loop {
            tokio::select! {
                Some(event) = rx.recv() => {
                    buffer.push(event);
                    pending_change = true;
                    delay.as_mut().reset(Instant::now() + Duration::from_millis(500));
                }
                _ = &mut delay, if pending_change => {
                    let deduped_events = Self::deduplicate_events(std::mem::take(&mut buffer));
                    for event in deduped_events {
                        let payload = Self::compile_context(event).await;
                        let _ = agent_tx.send(payload);
                    }
                    pending_change = false;
                }
            }
        }
    }

    fn deduplicate_events(events: Vec<WorkspaceEvent>) -> Vec<WorkspaceEvent> {
        let mut deduped: HashMap<PathBuf, WorkspaceEvent> = HashMap::new();
        for event in events {
            deduped.entry(event.file_path.clone())
                .and_modify(|existing| {
                    let preserved_category = if existing.category == FileCategory::Unknown && event.category != FileCategory::Unknown {
                        event.category.clone()
                    } else {
                        existing.category.clone()
                    };
                    *existing = event.clone();
                    existing.category = preserved_category;
                })
                .or_insert(event);
        }
        deduped.into_values().collect()
    }

    async fn compile_context(event: WorkspaceEvent) -> AgentContextPayload {
        let mut fault_vector = None;
        let mut prohibited_tokens = Vec::new();
        let mut active_week = 1;
        let mut course_id = String::from("cs50x-2026");

        // 1. If it is a note, dynamically parse YAML frontmatter to resolve active week
        if event.category == FileCategory::Note {
            if let Ok(content) = tokio::fs::read_to_string(&event.file_path).await {
                let re = regex::Regex::new(r"(?m)^week:\s*(\d+)").unwrap();
                if let Some(caps) = re.captures(&content) {
                    if let Some(m) = caps.get(1) {
                        if let Ok(w) = m.as_str().parse::<usize>() {
                            active_week = w;
                        }
                    }
                }
            }
        }

        // 2. Load the manifests dynamically to extract prohibited tokens for the active week
        let manifest_path = Path::new("d:/Calyx Scholar/tutor-core/manifests/cs50x.json");
        if let Ok(manifest_content) = tokio::fs::read_to_string(manifest_path).await {
            if let Ok(manifest): Result<Manifest, _> = serde_json::from_str(&manifest_content) {
                course_id = manifest.course_id;
                if let Some(w) = manifest.weeks.iter().find(|w| w.week == active_week) {
                    let mut valid = true;
                    for keyword in &w.validation_criteria.prohibited_keywords {
                        if keyword.len() > 256 {
                            valid = false;
                            fault_vector = Some(crate::telemetry::types::TelemetryFaultVector {
                                source_file: manifest_path.to_path_buf(),
                                line_number: 1,
                                column: 1,
                                severity: String::from("error"),
                                message: format!("Keyword '{}' exceeds the absolute safety cap of 256 bytes.", keyword),
                                fault_category: String::from("manifest_safety_violation"),
                            });
                            break;
                        }
                    }
                    if valid {
                        prohibited_tokens = w.validation_criteria.prohibited_keywords.clone();
                    } else {
                        prohibited_tokens = Vec::new();
                    }
                }
            }
        }

        // 3. Dynamic multi-language grammar AST routing pipeline
        if event.category == FileCategory::SourceCode {
            if let Ok(source_code) = tokio::fs::read_to_string(&event.file_path).await {
                let extension = event.file_path.extension().and_then(|e| e.to_str());
                let language = match extension {
                    Some("py") => Some(tree_sitter_python::LANGUAGE.into()),
                    _ => Some(tree_sitter_c::LANGUAGE.into()), 
                };

                if let Some(lang) = language {
                    let mut ts_parser = StaticASTParser::new(lang);
                    fault_vector = ts_parser.analyze_source(&source_code, event.file_path.clone());
                }
            }
        }

        AgentContextPayload {
            event,
            active_week,
            course_id,
            prohibited_tokens,
            fault_vector,
        }
    }
}
