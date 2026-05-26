pub struct SocraticFilter {
    buffer: [u8; 256],
    head: usize,
    count: usize,
    prohibited_sequences: Vec<Vec<u8>>,
    max_len: usize,
}

impl SocraticFilter {
    pub fn new(prohibited_strings: Vec<String>) -> Self {
        // Calculate the maximum prohibited token string length dynamically
        let max_len = prohibited_strings
            .iter()
            .map(|s| s.len())
            .max()
            .unwrap_or(0);
            
        // Limit max_len to 256 to strictly maintain our stack array safety boundary
        let max_len = std::cmp::min(max_len, 256);

        let prohibited_sequences = prohibited_strings
            .into_iter()
            .map(|s| s.into_bytes())
            .collect();

        Self {
            buffer: [0u8; 256],
            head: 0,
            count: 0,
            prohibited_sequences,
            max_len,
        }
    }

    /// Feeds a new byte to the sliding window filter. 
    /// Returns `true` if code boundaries remain clean, or `false` if a violation triggers.
    pub fn feed_byte(&mut self, byte: u8) -> bool {
        // Zero-heap sliding updates directly on the stack array
        self.buffer[self.head] = byte;
        self.head = (self.head + 1) % 256;
        if self.count < 256 {
            self.count += 1;
        }

        // Dynamically extract the last N bytes (capped at max_len)
        let active_window_size = std::cmp::min(self.count, self.max_len);
        if active_window_size == 0 {
            return true;
        }

        let mut active_slice = [0u8; 256];
        for i in 0..active_window_size {
            // Traverse circular ring backwards from head
            let idx = (self.head + 256 - active_window_size + i) % 256;
            active_slice[i] = self.buffer[idx];
        }
        let current_window = &active_slice[0..active_window_size];

        // Search the sliding window for matches
        for sequence in &self.prohibited_sequences {
            if sequence.is_empty() || sequence.len() > current_window.len() {
                continue;
            }
            if current_window.windows(sequence.len()).any(|w| w == sequence) {
                return false;
            }
        }

        // Always check codeblock boundaries as well
        let block_check_size = std::cmp::min(self.count, 3);
        let mut block_slice = [0u8; 3];
        for i in 0..block_check_size {
            let idx = (self.head + 256 - block_check_size + i) % 256;
            block_slice[i] = self.buffer[idx];
        }
        if &block_slice[0..block_check_size] == b"```" {
            return false;
        }

        true
    }
}
