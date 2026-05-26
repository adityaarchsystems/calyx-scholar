use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum FileCategory {
    Note,
    Assessment,
    SourceCode,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TelemetryFaultVector {
    pub source_file: PathBuf,
    pub line_number: usize,
    pub column: usize,
    pub severity: String, // "error" | "warning"
    pub message: String,
    pub fault_category: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceEvent {
    pub timestamp: u64, // Epoch signature in milliseconds
    pub file_path: PathBuf,
    pub category: FileCategory,
    pub relative_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentContextPayload {
    pub event: WorkspaceEvent,
    pub active_week: usize,
    pub course_id: String,
    pub prohibited_tokens: Vec<String>,
    pub fault_vector: Option<TelemetryFaultVector>,
}
