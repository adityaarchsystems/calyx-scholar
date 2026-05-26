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
      className={`col-start-1 row-start-1 row-span-2 flex flex-col h-full glass-card transition-all duration-500 ${hasErrors ? 'border-red-500 bg-[rgba(239,68,68,0.08)] shadow-[0_0_20px_rgba(239,68,68,0.2)]' : 'hover:border-[#d8b4fe]/30'}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/[0.04] bg-white/[0.02]">
        <span className="text-xs font-bold tracking-widest text-[#ffffff] uppercase font-sans active-hud-glow">
          Workspace Explorer
        </span>
        <span className={`glowing-indicator ${hasErrors ? 'red' : 'green'} scale-110`} />
      </div>

      {/* File List / Onboarding Skeletons */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-thin select-none">
        {fileList.length === 0 ? (
          // Translucent silver-amethyst gradient skeleton cards with sashes
          <div className="space-y-3 py-1">
            <div className="text-[10px] text-slate-400 tracking-wider font-sans uppercase mb-2 animate-pulse font-medium">
              Ingesting workspace files...
            </div>
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="flex items-center gap-3 p-3 rounded-xl border border-[#d8b4fe]/10 bg-gradient-to-r from-[#d8b4fe]/[0.02] to-transparent animate-pulse shadow-[inset_0_1px_1px_rgba(216,180,254,0.02)]"
              >
                <div className="w-4 h-4 rounded bg-[#d8b4fe]/15 shrink-0" />
                <div className={`h-2.5 bg-[#d8b4fe]/10 rounded-full ${i % 2 === 0 ? 'w-2/3' : 'w-1/2'}`} />
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
                    ? 'bg-[#d8b4fe]/12 text-[#ffffff] border-[#d8b4fe]/50 font-bold active-hud-glow shadow-[0_0_12px_rgba(216,180,254,0.2)]'
                    : 'text-slate-400 hover:text-[#f8fafc] hover:bg-white/[0.02] border-transparent font-medium'
                }`}
              >
                <span>{displayName}</span>
                {isSelected ? (
                  <span className="text-[9px] tracking-widest text-[#d8b4fe] font-bold bg-[#d8b4fe]/25 px-1.5 py-0.5 rounded-lg font-sans">
                    SEL
                  </span>
                ) : (
                  <span className="text-[9px] tracking-widest text-slate-500 font-bold opacity-0 group-hover:opacity-100 transition-opacity duration-300 font-sans">
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
        <div className="text-[10px] font-bold text-[#ffffff] tracking-widest uppercase font-sans active-hud-glow">
          Industrial Telemetry
        </div>
        
        <div className="grid grid-cols-2 gap-3 text-[11px] font-sans">
          <div className="bg-[#121220]/45 p-3 rounded-xl border border-white/[0.04] hover:border-[#d8b4fe]/25 transition-all duration-300">
            <span className="text-[#94a3b8] uppercase block text-[9px] tracking-wide mb-1 font-sans font-medium">Syllabus Week</span>
            <span className="font-bold text-[#ffffff]">Week 0{currentWeek}</span>
          </div>
          <div className="bg-[#121220]/45 p-3 rounded-xl border border-white/[0.04] hover:border-[#d8b4fe]/25 transition-all duration-300">
            <span className="text-[#94a3b8] uppercase block text-[9px] tracking-wide mb-1 font-sans font-medium">Active Filters</span>
            <span className="font-bold text-[#ffffff]">{prohibitedTokens.length} Tokens</span>
          </div>
        </div>

        <div className="bg-[#121220]/45 p-3 rounded-xl border border-white/[0.04] space-y-2 font-sans hover:border-[#d8b4fe]/25 transition-all duration-300">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-[#94a3b8] font-medium">Fault Resolution</span>
            <span className={`font-bold text-xs ${hasErrors ? 'text-red-500 active-hud-glow' : 'text-emerald-400'}`}>
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

        <div className="flex items-center justify-between text-[10px] text-slate-500 font-sans tracking-wide">
          <span>SYS_STATUS: ACTIVE</span>
          <span className="text-slate-400 font-bold font-mono">{isSandbox ? 'ENV_SANDBOX' : 'ENV_TAURI'}</span>
        </div>
      </div>
    </div>
  );
};
