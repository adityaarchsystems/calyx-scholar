import { create } from 'zustand';
import { TelemetryFault } from '../types/telemetry';

interface WorkspaceState {
  activeFile: string | null;
  activeFileContent: string;
  currentWeek: number;
  courseId: string;
  telemetryErrors: TelemetryFault[];
  prohibitedTokens: string[];
  isStreaming: boolean;
  activeTab: 'notes' | 'assessment' | 'terminal';
  fileList: string[];
  
  // Asynchronous Core Actions
  setActiveFile: (filePath: string | null) => Promise<void>;
  setTelemetryErrors: (errors: TelemetryFault[]) => void;
  setStreamingState: (streaming: boolean) => void;
  setSyllabusConstraints: (week: number, tokens: string[]) => void;
  executePtyCommand: (_command: string) => Promise<void>;
  handleStreamViolation: () => void;
  initializeWorkspace: () => Promise<void>;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  activeFile: null,
  activeFileContent: '',
  currentWeek: 1,
  courseId: 'cs50x-2026',
  telemetryErrors: [],
  prohibitedTokens: [],
  isStreaming: false,
  activeTab: 'notes',
  fileList: [],

  setActiveFile: async (filePath) => {
    set({ activeFile: filePath });
    const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
    if (filePath) {
      if (isTauri) {
        try {
          const { invoke } = await import('@tauri-apps/api/core');
          const content = await invoke<string>('load_file_content', { path: filePath });
          set({ activeFileContent: content });
        } catch (e) {
          console.error("Failed to load file content:", e);
        }
      } else {
        // Browser Sandbox
        const stored = localStorage.getItem(`calyx_mock_${filePath}`);
        const defaultMockDocs: Record<string, string> = {
          'lecture1.md': `# CS50x Week 1: C Programming & Computational Telemetry\n\nWelcome to the **Calyx Scholar** guided active learning interface.\nIn this lecture, we explore structural constraints, static analysis boundaries, and AST token structures.\n\n## Prohibited Construct Rules\nTo encourage low-level syntactic awareness, your compiler operates in a **zero-loop validation context**:\n- The \`while\` keyword is prohibited.\n- The \`for\` keyword is prohibited.\n- The \`do\` keyword is prohibited.\n\n## Active Learning Sandbox\nTry mapping your logic trees using pure, stack-allocated recursive cascades or conditional jumps instead of typical circular constructs. Fulfill the week manifest to unlock the compiling nodes.`,
          'assessment1.md': `# Assessment 1: Recursive Mathematical Integrations\n\nImplement a recursive function to compute factorials or Fibonacci numbers without utilizing circular iteration keywords (\`for\`, \`while\`).\n\n## System Validation Check\nWrite your recursive function below and press save to trigger the Socratic static telemetry parser loop.`
        };
        const filename = filePath.split('/').pop() || filePath;
        const content = stored !== null ? stored : (defaultMockDocs[filename] || `# ${filename}\n\nWorkspace Note Loaded. Sandbox simulation enabled.`);
        set({ activeFileContent: content });
      }
    } else {
      set({ activeFileContent: '' });
    }
    
    if (isTauri) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const files = await invoke<string[]>('get_workspace_files');
        set({ fileList: files });
      } catch (e) {
        console.error("Workspace file sync failure:", e);
      }
    } else {
      set({ fileList: ['lecture1.md', 'assessment1.md'] });
    }
  },

  setTelemetryErrors: (errors) => set({ telemetryErrors: errors }),
  
  setStreamingState: (streaming) => set({ isStreaming: streaming }),

  setSyllabusConstraints: (week, tokens) => set({ currentWeek: week, prohibitedTokens: tokens }),

  executePtyCommand: async (_command) => {
    // Core PTY shell invocation layer link
  },

  handleStreamViolation: () => {
    set({
      isStreaming: false,
      telemetryErrors: [],
      // Viewport state transition targets execute here inside the atomic thread lock
    });
  },

  initializeWorkspace: async () => {
    const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
    if (isTauri) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const files = await invoke<string[]>('get_workspace_files');
        set({ fileList: files });
        
        const currentActive = useWorkspaceStore.getState().activeFile;
        if (!currentActive && files.length > 0) {
          const defaultFile = files[0];
          set({ activeFile: defaultFile });
          try {
            const content = await invoke<string>('load_file_content', { path: defaultFile });
            set({ activeFileContent: content });
          } catch (e) {
            console.error("Failed to load content for default file:", e);
          }
        }
      } catch (e) {
        console.error("Workspace cold-start hydration failure:", e);
      }
    } else {
      // Browser Sandbox
      const files = ['lecture1.md', 'assessment1.md'];
      set({ fileList: files });
      const currentActive = useWorkspaceStore.getState().activeFile;
      if (!currentActive && files.length > 0) {
        const defaultFile = files[0];
        set({ activeFile: defaultFile });
        const stored = localStorage.getItem(`calyx_mock_${defaultFile}`);
        const defaultMockDocs: Record<string, string> = {
          'lecture1.md': `# CS50x Week 1: C Programming & Computational Telemetry\n\nWelcome to the **Calyx Scholar** guided active learning interface.\nIn this lecture, we explore structural constraints, static analysis boundaries, and AST token structures.\n\n## Prohibited Construct Rules\nTo encourage low-level syntactic awareness, your compiler operates in a **zero-loop validation context**:\n- The \`while\` keyword is prohibited.\n- The \`for\` keyword is prohibited.\n- The \`do\` keyword is prohibited.\n\n## Active Learning Sandbox\nTry mapping your logic trees using pure, stack-allocated recursive cascades or conditional jumps instead of typical circular constructs. Fulfill the week manifest to unlock the compiling nodes.`,
          'assessment1.md': `# Assessment 1: Recursive Mathematical Integrations\n\nImplement a recursive function to compute factorials or Fibonacci numbers without utilizing circular iteration keywords (\`for\`, \`while\`).\n\n## System Validation Check\nWrite your recursive function below and press save to trigger the Socratic static telemetry parser loop.`
        };
        const content = stored !== null ? stored : (defaultMockDocs[defaultFile] || '');
        set({ activeFileContent: content });
      }
    }
  }
}));
