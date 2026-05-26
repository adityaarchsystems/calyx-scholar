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
    if (filePath) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const content = await invoke<string>('load_file_content', { path: filePath });
        set({ activeFileContent: content });
      } catch (e) {
        console.error("Failed to load file content:", e);
      }
    } else {
      set({ activeFileContent: '' });
    }
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const files = await invoke<string[]>('get_workspace_files');
      set({ fileList: files });
    } catch (e) {
      console.error("Workspace file sync failure:", e);
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
  }
}));
