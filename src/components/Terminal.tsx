import React, { useEffect, useRef, useState } from 'react';
import { Terminal as Xterm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import 'xterm/css/xterm.css';

export const Terminal: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Xterm | null>(null);
  const [ptyFailed, setPtyFailed] = useState<boolean>(false);

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Xterm({
      cursorBlink: true,
      theme: {
        background: '#0a0a0a',
        foreground: '#d4d4d4',
        cursor: '#a3a3a3',
      },
      fontFamily: 'monospace',
      fontSize: 12,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    
    term.open(containerRef.current);
    fitAddon.fit();
    xtermRef.current = term;

    invoke('spawn_pty').then(() => {
      const initialDims = fitAddon.proposeDimensions();
      if (initialDims) {
        invoke('resize_pty', { cols: initialDims.cols, rows: initialDims.rows }).catch(console.error);
      }
    }).catch((err) => {
      console.error("PTY Sub-shell Spawn Failed:", err);
      setPtyFailed(true);
    });

    const unlistenStdout = listen<string>('terminal-stdout', (event) => {
      term.write(event.payload);
    });

    term.onData((data) => {
      invoke('write_to_pty', { data }).catch(console.error);
    });

    // PTY Geometry Resize Loop Observer implementation
    const resizeObserver = new ResizeObserver(() => {
      try {
        fitAddon.fit();
        const dims = fitAddon.proposeDimensions();
        if (dims) {
          invoke('resize_pty', { cols: dims.cols, rows: dims.rows }).catch(console.error);
        }
      } catch (e) {
        console.error("PTY Layout Resize fault:", e);
      }
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      unlistenStdout.then((f) => f());
      resizeObserver.disconnect();
      term.dispose();
    };
  }, []);

  return (
    <div className="w-full h-full bg-[#0a0a0a] border-t border-neutral-800 flex flex-col font-mono">
      <div className="p-2 text-xs font-semibold text-neutral-400 border-b border-neutral-800 uppercase tracking-wider">
        CS-SCHOLAR-PASSPORT // Terminal Sub-Shell
      </div>
      
      {ptyFailed ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-[#0a0a0a]">
          <div className="mb-4 text-xs tracking-wide text-[#ef4444] border border-[#ef4444] px-3 py-1 uppercase rounded bg-[rgba(239,68,68,0.05)]">
            PTY Sub-Shell Execution Blocked
          </div>
          <p className="text-xs text-neutral-400 max-w-md mb-6 leading-relaxed">
            Windows administrative policy has blocked the automatic PowerShell shell allocation. Calyx Scholar is prohibited from falling back to non-telemetric CMD sessions.
          </p>
          <div className="text-left bg-neutral-950 p-4 border border-neutral-800 rounded text-[11px] max-w-lg w-full text-neutral-300 space-y-2">
            <div className="text-[#d97706] font-semibold uppercase tracking-wider mb-1">
              Instructions to Grant Execution Privileges:
            </div>
            <div>1. Open PowerShell on your computer as <span className="text-[#ef4444] font-semibold">Administrator</span>.</div>
            <div>2. Enable system-level script execution by typing the command:</div>
            <div className="bg-neutral-900 p-2 border border-neutral-800 select-all rounded text-neutral-200 font-mono text-[10px] break-all my-1 cursor-pointer">
              Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope LocalMachine
            </div>
            <div>3. Relaunch Calyx Scholar to establish the secure Socratic telemetry stream.</div>
          </div>
        </div>
      ) : (
        <div ref={containerRef} className="flex-1 p-2 overflow-hidden" id="terminal-container" />
      )}
    </div>
  );
};
