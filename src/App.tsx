import React, { useEffect } from 'react';
import { Editor } from './components/Editor';
import { Terminal } from './components/Terminal';
import { Chat } from './components/Chat';
import { WorkspaceExplorer } from './components/WorkspaceExplorer';
import { useTauriIPC } from './hooks/useTauriIPC';
import { useWorkspaceStore } from './store/workspaceStore';

const App: React.FC = () => {
  // Initialize type-safe Tauri listeners and global background channel events
  useTauriIPC();

  const initializeWorkspace = useWorkspaceStore((state) => state.initializeWorkspace);

  useEffect(() => {
    initializeWorkspace();
  }, [initializeWorkspace]);

  return (
    <div 
      aria-label="Calyx Scholar Workspace HUD"
      className="w-screen h-screen min-h-screen max-h-screen overflow-hidden bg-transparent p-4 gap-4 grid grid-cols-[280px_1fr_380px] grid-rows-[1fr_240px] font-sans antialiased text-slate-200 select-none"
    >
      {/* Column 1: Workspace Explorer and Industrial Telemetry (Spans both rows) */}
      <WorkspaceExplorer />

      {/* Column 2, Row 1: Core Viewport Editor (Aspect locked and min-width bounded) */}
      <div className="col-start-2 row-start-1 min-w-0 relative overflow-hidden glass-card">
        <Editor />
      </div>

      {/* Column 2, Row 2: Terminal Sub-Shell (Locked at absolute height boundary) */}
      <div className="col-start-2 row-start-2 min-w-0 relative overflow-hidden glass-card">
        <Terminal />
      </div>

      {/* Column 3: Socratic Interaction Stream (Spans both rows, aspect locked at 380px) */}
      <div className="col-start-3 row-start-1 row-span-2 min-w-0 relative overflow-hidden glass-card">
        <Chat />
      </div>
    </div>
  );
};

export default App;
