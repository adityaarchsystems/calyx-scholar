use crate::telemetry::types::TelemetryFaultVector;
use std::path::PathBuf;
use tree_sitter::{Parser, Language, Node, TreeCursor};

pub struct StaticASTParser {
    parser: Parser,
}

impl StaticASTParser {
    pub fn new(language: Language) -> Self {
        let mut parser = Parser::new();
        parser.set_language(&language).expect("Error loading target language parser grammar signature");
        Self { parser }
    }

    pub fn analyze_source(&mut self, source_code: &str, file_path: PathBuf) -> Option<TelemetryFaultVector> {
        let tree = self.parser.parse(source_code, None)?;
        let mut cursor = tree.walk();
        let source_bytes = source_code.as_bytes();
        
        loop {
            let node = cursor.node();
            if node.is_error() || node.is_missing() {
                let start = node.start_position();
                
                // Extract precise code text slices via raw byte offsets
                let mut error_text = match node.utf8_text(source_bytes) {
                    Ok(text) if !text.is_empty() => text.to_string(),
                    _ => node.kind().to_string(),
                };

                // Defensive Multi-Line and Length Truncation to protect Socratic context limits
                if error_text.contains('\n') {
                    if let Some(first_line) = error_text.lines().next() {
                        error_text = format!("{}...", first_line.trim());
                    }
                }
                if error_text.len() > 96 {
                    error_text = format!("{}...", &error_text[0..93].trim());
                }

                return Some(TelemetryFaultVector {
                    source_file: file_path,
                    line_number: start.row + 1,
                    column: start.column + 1,
                    severity: String::from("error"),
                    message: format!("Structural syntax anomaly matched: '{}'", error_text),
                    fault_category: String::from("syntax_error"),
                });
            }

            if cursor.goto_first_child() {
                continue;
            }

            while !cursor.goto_next_sibling() {
                if !cursor.goto_parent() {
                    return None;
                }
            }
        }
    }
}
