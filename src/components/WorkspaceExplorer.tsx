import React, { useEffect, useState } from 'react';
import { useWorkspaceStore } from '../store/workspaceStore';

export const WorkspaceExplorer: React.FC = () => {
  const fileList = useWorkspaceStore((state) => state.fileList);
  const activeFile = useWorkspaceStore((state) => state.activeFile);
  const setActiveFile = useWorkspaceStore((state) => state.setActiveFile);
  const currentWeek = useWorkspaceStore((state) => state.currentWeek);
  const prohibitedTokens = useWorkspaceStore((state) => state.prohibitedTokens);
  const telemetryErrors = useWorkspaceStore((state) => state.telemetryErrors);

  const [isSandbox, setIsSandbox] = useState<boolean>(false);

  useEffect(() => {
    setIsSandbox(!('__TAURI_INTERNALS__' in window));
  }, []);

  const hasErrors = telemetryErrors.length > 0;

  return (
    <div 
      aria-label="Workspace File Explorer"
      className={`col-start-1 row-start-1 row-span-2 flex flex-col h-full glass-card transition-all duration-500 ${hasErrors ? 'border-red-500/20' : ''}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/[0.04] bg-white/[0.02]">
        <span className="text-xs font-semibold tracking-wider text-slate-300 uppercase font-sans">
          Workspace Explorer
        </span>
        <span className={`glowing-indicator ${hasErrors ? 'red' : 'green'}`} />
      </div>

      {/* File List / Onboarding Skeletons */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-thin select-none">
        {fileList.length === 0 ? (
          // Ultra-Luxury glass structural skeletal loading list
          <div className="space-y-3 py-1">
            <div className="text-[10px] text-slate-500 tracking-wider font-mono uppercase mb-2 animate-pulse">
              INGESTING FILE SYSTEM...
            </div>
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="flex items-center gap-3 p-3 rounded-xl border border-white/[0.02] bg-white/[0.01] animate-pulse"
              >
                <div className="w-4 h-4 rounded bg-white/5 shrink-0" />
                <div className={`h-2.5 bg-white/5 rounded-full ${i % 2 === 0 ? 'w-2/3' : 'w-1/2'}`} />
              </div>
            ))}
          </div>
        ) : (
          fileList.map((file) => {
            const isSelected = activeFile === file;
            const displayName = file.split('/').pop() || file;
            return (
              <button
                key={file}
                onClick={() => setActiveFile(file)}
                className={`w-full text-left px-3.5 py-3 rounded-xl text-xs font-mono truncate transition-all duration-300 relative border flex items-center justify-between group ${
                  isSelected
                    ? 'bg-amber-500/5 text-amber-500 border-amber-500/20 shadow-inner'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.02] border-transparent'
                }`}
              >
                <span>{displayName}</span>
                {isSelected ? (
                  <span className="text-[9px] tracking-widest text-amber-500/80 font-bold bg-amber-500/10 px-1.5 py-0.5 rounded font-mono">
                    SEL
                  </span>
                ) : (
                  <span className="text-[9px] tracking-widest text-slate-600 font-bold opacity-0 group-hover:opacity-100 transition-opacity duration-300 font-mono">
                    LOAD
                  </span>
                )}
              </button>
            );
          })
        )}
      </div>

      {/* Telemetry Metrics Panel */}
      <div className="p-4 border-t border-white/[0.04] bg-white/[0.02] space-y-4">
        <div className="text-[10px] font-semibold text-slate-400 tracking-widest uppercase font-mono">
          // INDUSTRIAL TELEMETRY
        </div>
        
        <div className="grid grid-cols-2 gap-3 text-[11px]">
          <div className="bg-white/[0.01] p-3 rounded-xl border border-white/[0.03]">
            <span className="text-slate-500 uppercase block text-[9px] tracking-wide mb-1 font-sans">Syllabus Week</span>
            <span className="font-bold text-slate-200 font-mono">Week 0{currentWeek}</span>
          </div>
          <div className="bg-white/[0.01] p-3 rounded-xl border border-white/[0.03]">
            <span className="text-slate-500 uppercase block text-[9px] tracking-wide mb-1 font-sans">Active Filters</span>
            <span className="font-bold text-slate-200 font-mono">{prohibitedTokens.length} Tokens</span>
          </div>
        </div>

        <div className="bg-white/[0.01] p-3 rounded-xl border border-white/[0.03] space-y-2">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-500 font-sans">Fault Resolution</span>
            <span className={`font-mono font-bold text-xs ${hasErrors ? 'text-red-500' : 'text-emerald-500'}`}>
              {hasErrors ? 'CRIT_ERR' : 'NOMINAL'}
            </span>
          </div>
          <div className="w-full bg-black/40 h-1.5 rounded-full overflow-hidden border border-white/[0.02]">
            <div 
              className={`h-full transition-all duration-500 ${
                hasErrors ? 'bg-red-500 w-1/3' : 'bg-emerald-500 w-full'
              }`} 
            />
          </div>
        </div>

        <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
          <span>SYS_STATUS: ACTIVE</span>
          <span className="text-slate-400 font-bold">{isSandbox ? 'ENV_SANDBOX' : 'ENV_TAURI'}</span>
        </div>
      </div>
    </div>
  );
};
