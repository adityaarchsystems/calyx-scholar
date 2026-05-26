import React, { useEffect, useRef, useState } from 'react';
import { Terminal as Xterm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';

export const Terminal: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Xterm | null>(null);
  const [ptyFailed, setPtyFailed] = useState<boolean>(false);
  const [isSandbox, setIsSandbox] = useState<boolean>(false);

  useEffect(() => {
    if (!containerRef.current) return;

    // Detect native Tauri environment
    const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
    setIsSandbox(!isTauri);

    const term = new Xterm({
      cursorBlink: true,
      theme: {
        background: 'rgba(0, 0, 0, 0)', // Transparent canvas for silver-amethyst glass plates
        foreground: '#94a3b8',
        cursor: '#d8b4fe',
        selectionBackground: 'rgba(216, 180, 254, 0.3)',
      },
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: 12,
      lineHeight: 1.4,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    
    term.open(containerRef.current);
    try {
      fitAddon.fit();
    } catch (e) {
      console.warn("Initial fit failed safely:", e);
    }
    xtermRef.current = term;

    let unlistenStdout: Promise<() => void> | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let mockLogInterval: ReturnType<typeof setInterval> | null = null;

    if (isTauri) {
      import('@tauri-apps/api/core').then(({ invoke }) => {
        import('@tauri-apps/api/event').then(({ listen }) => {
          invoke('spawn_pty').then(() => {
            const initialDims = fitAddon.proposeDimensions();
            if (initialDims) {
              invoke('resize_pty', { cols: initialDims.cols, rows: initialDims.rows }).catch(console.error);
            }
          }).catch((err) => {
            console.error("PTY Sub-shell Spawn Failed:", err);
            setPtyFailed(true);
          });

          unlistenStdout = listen<string>('terminal-stdout', (event) => {
            term.write(event.payload);
          });

          term.onData((data) => {
            invoke('write_to_pty', { data }).catch(console.error);
          });

          resizeObserver = new ResizeObserver(() => {
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
          resizeObserver.observe(containerRef.current!);
        });
      });
    } else {
      // Standalone Browser Sandbox Simulation
      term.writeln('\x1b[1;35mCALYX SCHOLAR TERMINAL SIMULATION ENGINE\x1b[0m');
      term.writeln('\x1b[90m[IPC_BRIDGE]: Isolated browser sandbox detected. Spawning mock PTY session...\x1b[0m');
      term.writeln('');
      term.write('\x1b[1;35mcalyx-scholar@browser\x1b[0m:\x1b[1;37m~$\x1b[0m ');

      let inputBuffer = '';
      
      term.onData((data) => {
        if (data === '\r') { // Enter key
          term.write('\r\n');
          const cmd = inputBuffer.trim().toLowerCase();
          inputBuffer = '';

          if (cmd === 'help') {
            term.writeln('\x1b[1;35m┌────────────────────────────────────────────────────────────┐\x1b[0m');
            term.writeln('\x1b[1;35m│ CALYX SCHOLAR TELEMETRY SYSTEM OVERVIEW - BROWSER VIRTUAL  │\x1b[0m');
            term.writeln('\x1b[1;35m├────────────────────────────────────────────────────────────┤\x1b[0m');
            term.writeln('│ STATUS:    \x1b[32mONLINE (SANDBOX SIMULATION ACTIVE)\x1b[0m              │');
            term.writeln('│ PORT:      1420 │ SYLLABUS: CS50X WEEK 1 ACTIVE           │');
            term.writeln('│ TELEMETRY: 256-BYTE GUARDRAIL CIRCULAR BUFFER NOMINAL      │');
            term.writeln('\x1b[1;35m└────────────────────────────────────────────────────────────┘\x1b[0m');
          } else if (cmd === 'clear') {
            term.clear();
          } else if (cmd === 'status') {
            term.writeln('\x1b[32m[SYS_STATUS]: System resources nominal. Sandbox simulation running smoothly.\x1b[0m');
          } else if (cmd !== '') {
            term.writeln(`\x1b[31m[MOCK_SHELL]: Command '${cmd}' not found. Type 'help' for sandbox diagnostics.\x1b[0m`);
          }
          term.write('\x1b[1;35mcalyx-scholar@browser\x1b[0m:\x1b[1;37m~$\x1b[0m ');
        } else if (data === '\x7f') { // Backspace
          if (inputBuffer.length > 0) {
            inputBuffer = inputBuffer.slice(0, -1);
            term.write('\b \b');
          }
        } else {
          inputBuffer += data;
          term.write(data);
        }
      });

      // Stream high-density continuous industrial telemetry logs
      const mockLogs = [
        '[SYS_STATUS]: Ingesting workspace file nodes... OK',
        '[AST_COMPILER]: Zero-heap telemetry buffer allocated (256 bytes) -> O(1) stack space',
        '[IPC_BRIDGE]: Isolated sandbox listening on localhost:1420',
        '[SO_AGENT]: Socratic validation active. Prohibited constructs loaded: [while, for, do]',
        '[VIRTUAL_DEVICE]: PTY compile-time macro state: nominal',
        '[SYS_MONITOR]: Memory utilization: 14.2% | Active threads: 2'
      ];
      let logIndex = 0;

      mockLogInterval = setInterval(() => {
        if (inputBuffer.length === 0) {
          term.write(`\r\x1b[K\x1b[90m${mockLogs[logIndex]}\x1b[0m\r\n\x1b[1;35mcalyx-scholar@browser\x1b[0m:\x1b[1;37m~$\x1b[0m `);
          logIndex = (logIndex + 1) % mockLogs.length;
        }
      }, 6000);

      resizeObserver = new ResizeObserver(() => {
        try {
          fitAddon.fit();
        } catch (e) {
          console.error("PTY Layout Resize fault:", e);
        }
      });
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      if (unlistenStdout) unlistenStdout.then((f) => f());
      if (resizeObserver) resizeObserver.disconnect();
      if (mockLogInterval) clearInterval(mockLogInterval);
      term.dispose();
    };
  }, []);

  return (
    <div className="w-full h-full flex flex-col font-mono overflow-hidden bg-transparent">
      {/* Panel Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-transparent border-b border-white/[0.04]">
        <div className="text-xs font-bold text-[#ffffff] tracking-widest uppercase font-sans active-hud-glow">
          Terminal Console
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-500 font-sans tracking-wide uppercase">
            Environment: <span className="font-mono text-slate-400">{isSandbox ? 'Sandbox' : 'Tauri'}</span>
          </span>
          <span className="glowing-indicator green" />
        </div>
      </div>
      
      {ptyFailed ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-transparent">
          <div className="mb-4 text-xs tracking-wide text-[#ef4444] border border-[#ef4444]/20 px-3 py-1 uppercase rounded-xl bg-[rgba(239,68,68,0.05)] font-sans font-bold">
            PTY Sub-Shell Execution Blocked
          </div>
          <p className="text-xs text-slate-400 max-w-md mb-6 leading-relaxed font-sans">
            Windows administrative policy has blocked the automatic PowerShell shell allocation. Calyx Scholar is prohibited from falling back to non-telemetric CMD sessions.
          </p>
          <div className="text-left bg-[#161626]/60 p-4 border border-white/[0.03] rounded-2xl text-[11px] max-w-lg w-full text-slate-300 space-y-2 font-sans">
            <div className="text-[#d8b4fe] font-bold uppercase tracking-wider mb-1">
              Instructions to Grant Execution Privileges:
            </div>
            <div>1. Open PowerShell on your computer as <span className="text-[#ef4444] font-bold">Administrator</span>.</div>
            <div>2. Enable system-level script execution by typing the command:</div>
            <div className="bg-black/60 p-2.5 border border-white/[0.04] select-all rounded-xl text-slate-200 font-mono text-[10px] break-all my-1 cursor-pointer">
              Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope LocalMachine
            </div>
            <div>3. Relaunch Calyx Scholar to establish the secure Socratic telemetry stream.</div>
          </div>
        </div>
      ) : (
        <div ref={containerRef} className="flex-1 p-3 overflow-hidden bg-transparent" id="terminal-container" />
      )}
    </div>
  );
};
