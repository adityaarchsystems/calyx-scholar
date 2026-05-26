import React, { useEffect, useRef } from 'react';
import { useWorkspaceStore } from '../store/workspaceStore';
import { listen } from '@tauri-apps/api/event';

export const Chat: React.FC = () => {
  const streamTargetRef = useRef<HTMLDivElement>(null);
  const fallbackRef = useRef<HTMLDivElement>(null);
  const handleStreamViolation = useWorkspaceStore((state) => state.handleStreamViolation);

  useEffect(() => {
    // Direct stream intercept link bypasses React rendering loops
    const unlistenChunk = listen<string>('socratic-token-chunk', (event) => {
      if (streamTargetRef.current) {
        streamTargetRef.current.textContent += event.payload;
      }
    });

    const unlistenViolation = listen<string>('socratic-violation', (event) => {
      // Execute atomic clear-down and fallback prompt asset substitution inside the 16ms window
      if (streamTargetRef.current && fallbackRef.current) {
        streamTargetRef.current.textContent = '';
        fallbackRef.current.innerHTML = `<div class="p-4 border border-red-900 bg-black text-neutral-400 font-mono text-xs">
          [SOCRATIC CONSTRAINT TRIGGERED]: Prohibited construct signature blocked. 
          <br/><br/>
          Context Diagnostic Challenge: ${event.payload}
        </div>`;
      }
      handleStreamViolation();
    });

    return () => {
      unlistenChunk.then((f) => f());
      unlistenViolation.then((f) => f());
    };
  }, [handleStreamViolation]);

  return (
    <div className="flex flex-col h-full border-l border-neutral-800 bg-neutral-950 font-mono text-sm text-neutral-200">
      <div className="p-2 border-b border-neutral-800 text-xs font-semibold text-neutral-400 uppercase tracking-wider">
        CS-SCHOLAR-SOCRATIC // Interaction Stream
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4 select-text">
        <div ref={streamTargetRef} className="whitespace-pre-wrap leading-relaxed text-neutral-300" />
        <div ref={fallbackRef} />
      </div>
    </div>
  );
};
