import React, { useEffect } from 'react';
import { Editor } from './components/Editor';
import { Terminal } from './components/Terminal';
import { Chat } from './components/Chat';
import { useTauriIPC } from './hooks/useTauriIPC';
import { useWorkspaceStore } from './store/workspaceStore';

const App: React.FC = () => {
  // Initialize type-safe Tauri listeners and global background channel events
  useTauriIPC();

  const fileList = useWorkspaceStore((state) => state.fileList);
  const activeFile = useWorkspaceStore((state) => state.activeFile);
  const setActiveFile = useWorkspaceStore((state) => state.setActiveFile);
  const initializeWorkspace = useWorkspaceStore((state) => state.initializeWorkspace);

  useEffect(() => {
    initializeWorkspace();
  }, [initializeWorkspace]);

  return (
    <div className="w-screen h-screen flex bg-neutral-950 overflow-hidden font-mono text-sm antialiased text-neutral-200 select-none">
      {/* Minimalist Sidebar File Explorer */}
      <div className="w-52 border-r border-neutral-800 bg-[#070707] flex flex-col h-full shrink-0">
        <div className="p-3 text-xs font-semibold text-neutral-400 border-b border-neutral-800 uppercase tracking-wider">
          Workspace Explorer
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {fileList.map((file) => {
            const isSelected = activeFile === file;
            const displayName = file.split('/').pop() || file;
            return (
              <button
                key={file}
                onClick={() => setActiveFile(file)}
                className={`w-full text-left px-2.5 py-2 rounded text-xs font-mono truncate transition-all duration-200 block ${
                  isSelected
                    ? 'bg-neutral-900 text-slate-100 border-l-2 border-amber-600'
                    : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-950'
                }`}
              >
                {displayName}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Grid Viewport */}
      <div className="flex-1 grid grid-cols-2 h-full">
        <div className="flex flex-col h-full border-r border-neutral-800">
          <div className="flex-1 relative overflow-hidden">
            <Editor />
          </div>
          <div className="h-1/3 relative border-t border-neutral-800">
            <Terminal />
          </div>
        </div>
        <div className="h-full relative">
          <Chat />
        </div>
      </div>
    </div>
  );
};

export default App;
