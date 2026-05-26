import React, { useEffect, useRef, useState } from 'react';
import { useWorkspaceStore } from '../store/workspaceStore';

export const Chat: React.FC = () => {
  const streamTargetRef = useRef<HTMLDivElement>(null);
  const fallbackRef = useRef<HTMLDivElement>(null);
  const handleStreamViolation = useWorkspaceStore((state) => state.handleStreamViolation);
  
  const [streamStatus, setStreamStatus] = useState<'IDLE_NODE' | 'ACTIVE_STREAM' | 'VIOLATION'>('IDLE_NODE');

  useEffect(() => {
    const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

    let unlistenChunk: Promise<() => void> | null = null;
    let unlistenViolation: Promise<() => void> | null = null;
    let simulatedStreamInterval: ReturnType<typeof setInterval> | null = null;

    if (isTauri) {
      import('@tauri-apps/api/event').then(({ listen }) => {
        unlistenChunk = listen<string>('socratic-token-chunk', (event) => {
          setStreamStatus('ACTIVE_STREAM');
          if (streamTargetRef.current) {
            if (event.payload === '') {
              streamTargetRef.current.textContent = '';
            } else {
              streamTargetRef.current.textContent += event.payload;
            }
          }
        });

        unlistenViolation = listen<string>('socratic-violation', (event) => {
          setStreamStatus('VIOLATION');
          if (streamTargetRef.current && fallbackRef.current) {
            streamTargetRef.current.textContent = '';
            fallbackRef.current.innerHTML = `
              <div class="p-4 border border-red-500/20 bg-red-950/10 text-red-400 font-sans text-xs rounded-2xl space-y-3 transition-all duration-500 ease-out shadow-lg">
                <div class="font-bold uppercase tracking-wider text-red-500 flex items-center justify-between">
                  <span>Socratic Constraint Triggered</span>
                  <span class="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                </div>
                <div class="text-slate-350 leading-relaxed font-sans">Prohibited construct signature blocked. Socratic validation active to secure pedagogical goals.</div>
                <div class="bg-black/40 p-3 rounded-xl border border-red-950/20 text-[10px] break-all leading-normal text-slate-400 font-mono">
                  Context Diagnostic Challenge: ${event.payload}
                </div>
              </div>`;
          }
          handleStreamViolation();
        });
      });
    } else {
      // Browser Sandbox - Listen to custom mock AST violation events from the Editor
      const handleMockViolation = (e: Event) => {
        const customEvent = e as CustomEvent;
        const fault = customEvent.detail;
        
        setStreamStatus('ACTIVE_STREAM');
        
        if (streamTargetRef.current && fallbackRef.current) {
          streamTargetRef.current.textContent = '';
          fallbackRef.current.innerHTML = '';
          
          const socraticText = `I noticed a structural syntax anomaly in your workspace code: 'Prohibited construct signature detected under Week syllabus constraints.' on line ${fault.lineNumber}.\n\nIf we look closely at this expression, how does it align with our active weekly syllabus boundaries? What can we discover to refine the AST structure and fulfill validation requirements?`;
          
          let index = 0;
          if (simulatedStreamInterval) clearInterval(simulatedStreamInterval);
          
          simulatedStreamInterval = setInterval(() => {
            if (index < socraticText.length) {
              if (streamTargetRef.current) {
                streamTargetRef.current.textContent += socraticText[index];
              }
              index++;
            } else {
              if (simulatedStreamInterval) clearInterval(simulatedStreamInterval);
              setStreamStatus('IDLE_NODE');
              
              // Render the warning violation block in the sandbox
              if (fallbackRef.current) {
                fallbackRef.current.innerHTML = `
                  <div class="p-4 border border-red-500/20 bg-red-950/10 text-red-400 font-sans text-xs rounded-2xl space-y-3 mt-4 transition-all duration-500 ease-out shadow-lg">
                    <div class="font-bold uppercase tracking-wider text-red-500 flex items-center justify-between">
                      <span>Socratic Constraint Triggered</span>
                      <span class="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                    </div>
                    <div class="text-slate-355 leading-relaxed font-sans">Prohibited construct signature blocked inside browser simulation.</div>
                    <div class="bg-black/40 p-3 rounded-xl border border-red-950/20 text-[10px] break-all leading-normal text-slate-400 font-mono">
                      Context Diagnostic Challenge: Active Weekly syllabus filters violated.
                    </div>
                  </div>`;
              }
              setStreamStatus('VIOLATION');
              handleStreamViolation();
            }
          }, 15);
        }
      };

      window.addEventListener('socratic-mock-violation', handleMockViolation);

      return () => {
        window.removeEventListener('socratic-mock-violation', handleMockViolation);
        if (simulatedStreamInterval) clearInterval(simulatedStreamInterval);
      };
    }

    return () => {
      if (unlistenChunk) unlistenChunk.then((f) => f());
      if (unlistenViolation) unlistenViolation.then((f) => f());
    };
  }, [handleStreamViolation]);

  return (
    <div className="flex flex-col h-full bg-transparent font-sans text-sm text-slate-300 select-none">
      {/* Panel Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-white/[0.02] border-b border-white/[0.04]">
        <div className="text-xs font-semibold text-[#d8b4fe]/80 tracking-widest uppercase font-sans">
          Socratic Stream
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[9px] font-semibold font-sans px-2 py-0.5 rounded-lg ${
            streamStatus === 'VIOLATION' 
              ? 'bg-red-500/10 text-red-500 border border-red-500/20' 
              : streamStatus === 'ACTIVE_STREAM'
              ? 'bg-[#d8b4fe]/10 text-[#d8b4fe] border border-[#d8b4fe]/20 animate-pulse'
              : 'bg-white/5 text-slate-400 border border-white/10'
          }`}>
            {streamStatus}
          </span>
          <span className={`glowing-indicator ${
            streamStatus === 'VIOLATION' ? 'red' : streamStatus === 'ACTIVE_STREAM' ? 'amber' : 'slate'
          }`} />
        </div>
      </div>

      {/* Message Output Viewport */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 select-text scrollbar-thin">
        {/* Default Onboarding Frame if no stream has loaded */}
        {streamStatus === 'IDLE_NODE' && !streamTargetRef.current?.textContent && (
          <div className="p-4 border border-white/[0.03] bg-white/[0.01] rounded-2xl space-y-3 transition-all duration-300">
            <div className="text-[10px] font-bold text-[#d8b4fe]/80 uppercase tracking-wider font-sans">
              Socratic Interceptor
            </div>
            <p className="text-xs text-slate-400 leading-relaxed font-sans">
              The Socratic validator monitors AST structures recursively. As you compose note/code logic, weekly syntax boundaries are verified inside a stack-allocated buffer.
            </p>
            <div className="flex items-center gap-2 text-[10px] text-slate-500 font-sans tracking-wide">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
              <span>Listening for AST transactions...</span>
            </div>
          </div>
        )}

        {/* Asymmetrical silver-amethyst glass hint bubble */}
        <div 
          ref={streamTargetRef} 
          className="whitespace-pre-wrap leading-relaxed text-sm text-slate-200 font-sans tracking-wide bg-[#161626]/40 p-4 rounded-2xl border border-[#d8b4fe]/10 shadow-lg max-w-[95%] float-left transition-all duration-500 ease-out" 
        />
        <div ref={fallbackRef} className="clear-both" />
      </div>
    </div>
  );
};
