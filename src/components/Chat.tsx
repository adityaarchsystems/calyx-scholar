import React, { useEffect, useRef, useState } from 'react';
import { useWorkspaceStore } from '../store/workspaceStore';

export const Chat: React.FC = () => {
  const streamTargetRef = useRef<HTMLDivElement>(null);
  const fallbackRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  
  const handleStreamViolation = useWorkspaceStore((state) => state.handleStreamViolation);
  
  const [streamStatus, setStreamStatus] = useState<'IDLE_NODE' | 'ACTIVE_STREAM' | 'VIOLATION'>('IDLE_NODE');
  const [autoScrollLocked, setAutoScrollLocked] = useState<boolean>(false);

  const autoScrollLockedRef = useRef<boolean>(false);
  const isScrollingTicking = useRef<boolean>(false);

  // Sync scroll lock state to ref for safe access inside events
  useEffect(() => {
    autoScrollLockedRef.current = autoScrollLocked;
  }, [autoScrollLocked]);

  // Proximity scroll-lock check
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    const isAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 48;
    setAutoScrollLocked(!isAtBottom);
  };

  // Ticking-guarded requestAnimationFrame scroll to bottom
  const scrollToBottom = () => {
    if (!autoScrollLockedRef.current && !isScrollingTicking.current) {
      isScrollingTicking.current = true;
      requestAnimationFrame(() => {
        if (chatContainerRef.current) {
          chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
        isScrollingTicking.current = false;
      });
    }
  };

  // Immediate override and scroll reset for user-initiated transactions
  const forceScrollToBottom = () => {
    setAutoScrollLocked(false);
    autoScrollLockedRef.current = false;
    requestAnimationFrame(() => {
      if (chatContainerRef.current) {
        chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
      }
    });
  };

  // ResizeObserver layout anchor for Windows Tauri container scaling
  useEffect(() => {
    if (!chatContainerRef.current) return;

    const observer = new ResizeObserver(() => {
      if (!autoScrollLockedRef.current) {
        requestAnimationFrame(() => {
          if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
          }
        });
      }
    });

    observer.observe(chatContainerRef.current);

    return () => {
      observer.disconnect();
    };
  }, []);

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
              // Bypass active scroll lock, force update to bottom
              forceScrollToBottom();
            } else {
              streamTargetRef.current.textContent += event.payload;
              scrollToBottom();
            }
          }
        });

        unlistenViolation = listen<string>('socratic-violation', (event) => {
          setStreamStatus('VIOLATION');
          if (streamTargetRef.current && fallbackRef.current) {
            streamTargetRef.current.textContent = '';
            fallbackRef.current.innerHTML = `
              <div class="p-4 border-2 border-red-500 bg-[rgba(239,68,68,0.15)] text-red-100 font-sans text-xs rounded-xl space-y-3 shadow-[0_0_20px_rgba(239,68,68,0.2)] animate-slide-up hover:border-red-400 transition-all duration-350">
                <div class="font-bold uppercase tracking-wider text-red-400 flex items-center justify-between">
                  <span class="active-hud-glow">Socratic Constraint Triggered</span>
                  <span class="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                </div>
                <div class="text-slate-200 leading-relaxed font-sans font-medium">Prohibited construct signature blocked. Socratic validation active to secure pedagogical goals.</div>
                <div class="bg-black/45 p-3 rounded-lg border border-red-950/20 text-[10px] break-all leading-normal text-slate-300 font-mono">
                  Context Diagnostic Challenge: ${event.payload}
                </div>
              </div>`;
            forceScrollToBottom();
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
          
          // Force bottom scroll when user explicitly initiates a transaction
          forceScrollToBottom();
          
          const socraticText = `I noticed a structural syntax anomaly in your workspace code: 'Prohibited construct signature detected under Week syllabus constraints.' on line ${fault.lineNumber}.\n\nIf we look closely at this expression, how does it align with our active weekly syllabus boundaries? What can we discover to refine the AST structure and fulfill validation requirements?`;
          
          let index = 0;
          if (simulatedStreamInterval) clearInterval(simulatedStreamInterval);
          
          simulatedStreamInterval = setInterval(() => {
            if (index < socraticText.length) {
              if (streamTargetRef.current) {
                streamTargetRef.current.textContent += socraticText[index];
              }
              index++;
              scrollToBottom();
            } else {
              if (simulatedStreamInterval) clearInterval(simulatedStreamInterval);
              setStreamStatus('IDLE_NODE');
              
              // Render the warning violation block in the sandbox
              if (fallbackRef.current) {
                fallbackRef.current.innerHTML = `
                  <div class="p-4 border-2 border-red-500 bg-[rgba(239,68,68,0.15)] text-red-100 font-sans text-xs rounded-xl space-y-3 mt-4 shadow-[0_0_20px_rgba(239,68,68,0.2)] animate-slide-up hover:border-red-400 transition-all duration-350">
                    <div class="font-bold uppercase tracking-wider text-red-400 flex items-center justify-between">
                      <span class="active-hud-glow">Socratic Constraint Triggered</span>
                      <span class="w-2 h-2 rounded-full bg-red-500 animate-ping animate-hud-glow" />
                    </div>
                    <div class="text-slate-200 leading-relaxed font-sans font-medium">Prohibited construct signature blocked inside browser simulation.</div>
                    <div class="bg-black/45 p-3 rounded-lg border border-red-950/20 text-[10px] break-all leading-normal text-slate-300 font-mono">
                      Context Diagnostic Challenge: Active Weekly syllabus filters violated.
                    </div>
                  </div>`;
              }
              setStreamStatus('VIOLATION');
              handleStreamViolation();
              scrollToBottom();
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
      <div className="flex items-center justify-between px-4 py-3 bg-transparent border-b border-white/[0.04]">
        <div className="text-xs font-bold text-[#ffffff] tracking-widest uppercase font-sans active-hud-glow">
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
      <div 
        ref={chatContainerRef}
        onScroll={handleScroll}
        className="flex flex-col flex-1 min-h-0 overflow-y-auto scrollbar-thin p-4 space-y-4 select-text"
      >
        {/* Default Onboarding Frame if no stream has loaded */}
        {streamStatus === 'IDLE_NODE' && !streamTargetRef.current?.textContent && (
          <div className="p-4 border border-[#d8b4fe]/26 bg-[#141423]/40 backdrop-blur-xl rounded-xl space-y-3 transition-all duration-300 hover:border-[#d8b4fe]/45 animate-slide-up">
            <div className="text-[10px] font-bold text-[#ffffff] uppercase tracking-wider font-sans active-hud-glow">
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
          className="w-full h-auto min-h-max overflow-visible break-words whitespace-pre-wrap text-slate-100 selection:bg-[#c084fc]/30 font-sans tracking-wide bg-[#0c0c18]/70 backdrop-blur-xl p-4 rounded-xl border border-[#d8b4fe]/26 shadow-xl max-w-[95%] float-left transition-all duration-300 hover:border-[#d8b4fe]/45 hover:shadow-2xl animate-slide-up" 
        />
        <div ref={fallbackRef} className="clear-both" />
      </div>
    </div>
  );
};


