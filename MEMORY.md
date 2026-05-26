# MEMORY.md - Calyx Scholar System Taxonomy Ledger

## 📋 Foundational Context
* **Product Concept**: Decoupled, local-first, pedagogical IDE assisting novice developers through guided active learning logic.
* **Architecture**: Tauri 2.0 (Rust backend core) and React 19 / TypeScript 5.x (desktop view layer) utilizing local flat markdown note matrices.
* **Integration Nodes**: CodeMirror 6 (workspace source editing) and Xterm.js (PTY console interface).

## 🛑 Active Constraints
* **Maestro Purple Ban**: Absolute strict ban on all violet, purple, magenta, or lavender tones. Use slate grays, stark whites, tactical ambers, and neon gutter reds.
* **Zero-Heap Circular Buffer**: Telemetry stream filters must operate on the stack (`[u8; 256]`) within $O(1)$ allocations, adjusting search boundaries dynamically based on week manifest limitations.
* **PTY Compile-Time Safety**: Implement PTY bindings via native compile-time conditional macros (`#[cfg]`) to avoid dynamic runtime link failures on Windows targets.
* **Asynchronous Rust Paths**: Banish all blocking synchronous file operations (`std::fs`) in favor of asynchronous tokio file routines (`tokio::fs`).

## 🔍 Discovered Bug Vectors
* **Tailwind v4 Apex Ordering**: Resolved esbuild preprocessor warnings by placing Google Font `@import` statements at line 0 preceding all utility injections.
* **Empty Cold-Start States**: Resolved black viewports by engineering automatic async directory scans (`get_workspace_files`) and default note ingestion templates.
* **Synchronous File Traversal**: Banished blocking `std::fs` operations in the watcher telemetry thread and main command execution hooks, adopting async `tokio::fs`.
* **LinesCodec Deserialization**: Implemented `tokio_util::codec::LinesCodec` inside `inference.rs` to decode streamed JSON Ollama lines and protect boundaries.
* **Out-of-Order AST Marks**: Refactored raw decoration array loops to `RangeSetBuilder` to optimize marker mapping during concurrent typing transaction cascades.
* **PowerShell Spawn Blocked**: Handled Windows administrative policy Process creation blocks by displaying a gorgeous monochrome onboarding instructions view.
* **Empty Editor on Startup**: Mapped workspaceStore setActiveFile and initializeWorkspace actions to load note/code contents, resolving cold-start editor hydration defects.

## 🏆 Resolved Milestones
* **Phase 1 (Frontend Scaffolding)**: Completed Vite, React 19, and Tailwind v4 workspace build layouts.
* **Phase 2 (Tauri Core Backend)**: Configured debounced OS watcher events and registered safe workspace IPC invoke paths.
* **Phase 3 (Monochrome Design integration)**: Custom slate-amber-red syntax decoration markers wired to CodeMirror.
* **Phase 4 (Checking & Verification)**: Passed master `checklist.py` with 100% success scores.
* **Phase 5 (Multi-Agent Swarm Optimization)**: Swapped all synchronous file ingestions to non-blocking async, resolved import order anomalies, added dynamic cold-start sidebar explorer panels, and integrated `RangeSetBuilder` and `LinesCodec` event decoding pipelines.
* **Phase 6 (Engine Convergence & Production Swarm)**: Engineered the dynamic stack-allocated 256-byte guardrail circular buffer, implemented real-time reqwest client Ollama streaming with a robust simulated local character fallback loop, configured execution bypass policy parameters for PowerShell, and injected active content hydration hooks. Passed all 6 verification checks of the master checklist suite successfully.
