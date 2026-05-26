use crate::telemetry::guardrail::SocraticFilter;
use serde_json::{Value, json};
use tokio_util::codec::{Decoder, LinesCodec};

pub struct SocraticInferenceStream {
    filter: SocraticFilter,
}

impl SocraticInferenceStream {
    pub fn new(prohibited_tokens: Vec<String>) -> Self {
        Self {
            filter: SocraticFilter::new(prohibited_tokens),
        }
    }

    /// Process raw streamed bytes using tokio_util LinesCodec, decoding each JSON line,
    /// isolating the "response" token, and verifying it via the zero-heap guardrail filter.
    pub async fn process_raw_ollama_chunk<F>(
        &mut self,
        chunk_bytes: &[u8],
        mut emit_chunk: F,
    ) -> Result<(), String>
    where
        F: FnMut(&str),
    {
        // Setup LinesCodec
        let mut codec = LinesCodec::new();
        let mut bytes_mut = bytes::BytesMut::from(chunk_bytes);

        // Decode lines iteratively using the codec structure
        while let Ok(Some(line)) = codec.decode(&mut bytes_mut) {
            if line.is_empty() {
                continue;
            }

            // Parse each line as structured JSON metadata using serde_json
            if let Ok(json_val) = serde_json::from_str::<Value>(&line) {
                // Isolate the explicit "response" value token string
                if let Some(response_token) = json_val.get("response").and_then(|r| r.as_str()) {
                    // Pass ONLY the isolated text bytes to the safety guardrails
                    for byte in response_token.as_bytes() {
                        if !self.filter.feed_byte(*byte) {
                            return Err(String::from("Breach intercepted by zero-heap sliding stack buffer."));
                        }
                    }
                    emit_chunk(response_token);
                }
            }
        }

        Ok(())
    }

    /// Connects asynchronously to the local Ollama server, streams the response,
    /// parses server-sent events line-by-line using LinesCodec, and validates it.
    pub async fn stream_inference<F>(
        &mut self,
        prompt: &str,
        mut emit_chunk: F,
    ) -> Result<(), String>
    where
        F: FnMut(&str),
    {
        let client = reqwest::Client::new();
        let payload = json!({
            "model": "qwen2.5-coder:1.5b",
            "prompt": prompt,
            "stream": true
        });

        let mut response = client
            .post("http://localhost:11434/api/generate")
            .json(&payload)
            .send()
            .await
            .map_err(|e| format!("Ollama server connection error: {}", e))?;

        if !response.status().is_success() {
            return Err(format!("Model server returned error status: {}", response.status()));
        }

        let mut bytes_mut = bytes::BytesMut::new();
        let mut codec = LinesCodec::new();

        while let Some(chunk) = response.chunk().await.map_err(|e| e.to_string())? {
            bytes_mut.extend_from_slice(&chunk);

            while let Ok(Some(line)) = codec.decode(&mut bytes_mut) {
                if line.is_empty() {
                    continue;
                }

                if let Ok(json_val) = serde_json::from_str::<Value>(&line) {
                    if let Some(response_token) = json_val.get("response").and_then(|r| r.as_str()) {
                        for byte in response_token.as_bytes() {
                            if !self.filter.feed_byte(*byte) {
                                return Err(String::from("Breach intercepted by zero-heap sliding stack buffer."));
                            }
                        }
                        emit_chunk(response_token);
                    }
                }
            }
        }

        Ok(())
    }
}
