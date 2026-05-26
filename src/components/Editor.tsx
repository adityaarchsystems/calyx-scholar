import React, { useEffect, useRef, useState } from 'react';
import { EditorState, StateField, StateEffect, RangeSetBuilder } from '@codemirror/state';
import { EditorView, keymap, drawSelection, Decoration, DecorationSet } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';
import { useWorkspaceStore } from '../store/workspaceStore';
import { TelemetryFault } from '../types/telemetry';

export const setDiagnostics = StateEffect.define<TelemetryFault[]>();

export const diagnosticField = StateField.define<DecorationSet>({
  create() { return Decoration.none; },
  update(underlines, tr) {
    underlines = underlines.map(tr.changes);
    for (const effect of tr.effects) {
      if (effect.is(setDiagnostics)) {
        const errors = effect.value;
        const builder = new RangeSetBuilder<Decoration>();
        const sortedErrors = [...errors].sort((a, b) => a.lineNumber - b.lineNumber);
        
        for (const err of sortedErrors) {
          try {
            if (err.lineNumber > tr.state.doc.lines) continue;

            const line = tr.state.doc.line(err.lineNumber);
            const start = line.from + Math.min(err.column - 1, line.length);
            const end = line.to;
            
            if (start <= end && start >= 0 && end <= tr.state.doc.length) {
              builder.add(
                start,
                end,
                Decoration.mark({
                  class: 'cm-error-underline',
                  attributes: { title: err.message },
                })
              );
            }
          } catch (e) {
            // Defensively swallow bounds mismatch during rapid typing
          }
        }
        return builder.finish();
      }
    }
    return underlines;
  },
  provide: (f) => EditorView.decorations.from(f),
});

const customTheme = EditorView.theme({
  "&": {
    backgroundColor: "transparent !important",
    color: "#94a3b8 !important",
    height: "100%",
  },
  ".cm-content": {
    fontFamily: "'JetBrains Mono', monospace !important",
    fontSize: "13px !important",
  },
  ".cm-gutters": {
    backgroundColor: "rgba(5, 5, 8, 0.4) !important",
    color: "#64748b !important",
    borderRight: "1px solid rgba(216, 180, 254, 0.15) !important",
  },
  ".cm-activeLine": {
    backgroundColor: "rgba(216, 180, 254, 0.02) !important",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "rgba(216, 180, 254, 0.06) !important",
    color: "#d8b4fe !important",
  },
});

const customHighlightStyle = HighlightStyle.define([
  { tag: t.keyword, color: '#c084fc', backgroundColor: 'rgba(192, 132, 252, 0.12)', fontWeight: 'bold' },
  { tag: [t.name, t.deleted, t.character, t.propertyName, t.macroName], color: '#f8fafc' },
  { tag: [t.variableName, t.labelName], color: '#f8fafc' },
  { tag: [t.typeName, t.className, t.number, t.changed], color: '#94a3b8' },
  { tag: [t.comment, t.quote], color: '#64748b', fontStyle: 'italic' },
  { tag: [t.string, t.meta, t.regexp], color: '#e2e8f0' },
]);

// Browser Safe Mock Documents Data Store
const defaultMockDocs: Record<string, string> = {
  'lecture1.md': `# CS50x Week 1: C Programming & Computational Telemetry\n\nWelcome to the **Calyx Scholar** guided active learning interface.\nIn this lecture, we explore structural constraints, static analysis boundaries, and AST token structures.\n\n## Prohibited Construct Rules\nTo encourage low-level syntactic awareness, your compiler operates in a **zero-loop validation context**:\n- The \`while\` keyword is prohibited.\n- The \`for\` keyword is prohibited.\n- The \`do\` keyword is prohibited.\n\n## Active Learning Sandbox\nTry mapping your logic trees using pure, stack-allocated recursive cascades or conditional jumps instead of typical circular constructs. Fulfill the week manifest to unlock the compiling nodes.`,
  'assessment1.md': `# Assessment 1: Recursive Mathematical Integrations\n\nImplement a recursive function to compute factorials or Fibonacci numbers without utilizing circular iteration keywords (\`for\`, \`while\`).\n\n## System Validation Check\nWrite your recursive function below and press save to trigger the Socratic static telemetry parser loop.`
};

export const Editor: React.FC = () => {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const activeFile = useWorkspaceStore((state) => state.activeFile);
  const telemetryErrors = useWorkspaceStore((state) => state.telemetryErrors);
  const setTelemetryErrors = useWorkspaceStore((state) => state.setTelemetryErrors);
  const prohibitedTokens = useWorkspaceStore((state) => state.prohibitedTokens);

  const [logoSrc, setLogoSrc] = useState<string>('/logo.png');

  // Dynamic asset loading resolver for Tauri environments
  useEffect(() => {
    const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
    if (isTauri) {
      import('@tauri-apps/api/core').then(({ convertFileSrc }) => {
        const localPath = 'd:\\Calyx Scholar\\logo.png';
        try {
          const resolved = convertFileSrc(localPath);
          setLogoSrc(resolved);
        } catch (e) {
          console.error("Failed to load local logo asset via convertFileSrc:", e);
          setLogoSrc('/logo.png');
        }
      });
    } else {
      setLogoSrc('/logo.png');
    }
  }, []);

  useEffect(() => {
    if (!editorRef.current || !activeFile) return;

    const startState = EditorState.create({
      doc: '',
      extensions: [
        history(),
        drawSelection(),
        markdown(),
        diagnosticField,
        customTheme,
        syntaxHighlighting(customHighlightStyle),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

            const content = update.state.doc.toString();

            // Trailing-edge client-side debounce to prevent IPC overloading
            saveTimeoutRef.current = setTimeout(async () => {
              if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
                const { invoke } = await import('@tauri-apps/api/core');
                invoke('save_file_content', { content }).catch(console.error);
              } else {
                // Browser sandbox - save to local storage
                localStorage.setItem(`calyx_mock_${activeFile}`, content);
                
                // Run dynamic Browser-safe AST static analysis filter loop
                const activeProhibited = prohibitedTokens.length > 0 ? prohibitedTokens : ['while', 'for', 'do'];
                const lines = content.split('\n');
                const foundFaults: TelemetryFault[] = [];

                for (let i = 0; i < lines.length; i++) {
                  const lineText = lines[i];
                  for (const token of activeProhibited) {
                    const regex = new RegExp(`\\b${token}\\b`);
                    const match = lineText.match(regex);
                    if (match && match.index !== undefined) {
                      foundFaults.push({
                        sourceFile: activeFile,
                        lineNumber: i + 1,
                        column: match.index + 1,
                        severity: 'error',
                        message: `Prohibited construct '${token}' signature detected under Week syllabus constraints.`,
                        faultCategory: 'SyllabusConstraint',
                      });
                    }
                  }
                }
                
                setTelemetryErrors(foundFaults);
                
                // Broadcast a simulated socratic event to update Chat viewport
                if (foundFaults.length > 0) {
                  const event = new CustomEvent('socratic-mock-violation', {
                    detail: foundFaults[0]
                  });
                  window.dispatchEvent(event);
                }
              }
            }, 300);
          }
        }),
      ],
    });

    const view = new EditorView({ state: startState, parent: editorRef.current });
    viewRef.current = view;

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      view.destroy();
    };
  }, [activeFile, prohibitedTokens, setTelemetryErrors]);

  useEffect(() => {
    if (activeFile && viewRef.current) {
      if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
        import('@tauri-apps/api/core').then(({ invoke }) => {
          invoke<string>('load_file_content', { path: activeFile })
            .then((content) => {
              if (viewRef.current) {
                viewRef.current.dispatch({
                  changes: { from: 0, to: viewRef.current.state.doc.length, insert: content },
                });
              }
            })
            .catch(console.error);
        });
      } else {
        // Browser Sandbox - Load from local storage or load mock defaults
        const filename = activeFile.split('/').pop() || activeFile;
        const stored = localStorage.getItem(`calyx_mock_${activeFile}`);
        const content = stored !== null ? stored : (defaultMockDocs[filename] || `# ${filename}\n\nWorkspace Note Loaded. Sandbox simulation enabled.`);
        
        viewRef.current.dispatch({
          changes: { from: 0, to: viewRef.current.state.doc.length, insert: content },
        });
      }
    }
  }, [activeFile]);

  // Push telemetry adjustments down into the editor state field via effects
  useEffect(() => {
    if (viewRef.current) {
      viewRef.current.dispatch({
        effects: setDiagnostics.of(telemetryErrors),
      });
    }
  }, [telemetryErrors]);

  // Render onboarding/welcome grid if no active note buffer is selected
  if (!activeFile) {
    return (
      <div 
        aria-label="Core Viewport Welcome Deck"
        className="w-full h-full flex flex-col bg-white/[0.01] text-slate-350 font-sans p-5 overflow-y-auto select-none scrollbar-thin"
      >
        {/* Upper Metadata Telemetry Header Row */}
        <div className="flex items-center justify-between pb-3 border-b border-white/[0.04]">
          <div className="text-xs font-bold text-[#ffffff] tracking-widest uppercase font-sans active-hud-glow">
            Core Viewport
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[#94a3b8] font-mono tracking-tight uppercase">
              NO_FILE_LOADED
            </span>
            <span className="glowing-indicator green" />
          </div>
        </div>

        {/* Welcome Grid Content */}
        <div className="flex-1 flex flex-col items-center justify-center py-6 relative">
          {/* Circular Brand Logo Emblem with soft respiration loop */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity duration-700">
            <img 
              src={logoSrc} 
              alt="Scholastic Emblem Logo" 
              className="w-72 h-72 object-contain rounded-full border border-[#d8b4fe]/10 p-2 emblem-pulse"
              onError={() => setLogoSrc('/logo.png')}
            />
          </div>

          <div className="relative z-10 max-w-3xl w-full space-y-6 px-4">
            <div className="text-center space-y-2">
              <h2 className="text-xl font-bold text-[#ffffff] tracking-wide font-sans active-hud-glow">
                Welcome to Calyx Scholar
              </h2>
              <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                A decoupled, pedagogical IDE designed to assist novice developers through guided active learning logic.
              </p>
            </div>

            {/* Asymmetric Layout Deck utilizing crisp rounded-xl glass panels bordered by reflective silver-amethyst sashes */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
              {/* Panel 1: Keyboard Shortcuts (md:col-span-2) */}
              <div className="md:col-span-2 bg-[#141423]/50 backdrop-blur-xl rounded-xl border border-[#d8b4fe]/24 p-4 shadow-xl space-y-3 transition-all duration-300 hover:border-[#d8b4fe]/45 hover:shadow-2xl hover:shadow-[#d8b4fe]/5">
                <div className="flex items-center justify-between border-b border-white/[0.04] pb-2">
                  <span className="text-[9px] font-bold tracking-widest text-[#ffffff] font-sans uppercase active-hud-glow">
                    Command Shortcuts
                  </span>
                  <span className="text-[8px] text-[#94a3b8] font-sans tracking-wider">SYSTEM_MAPPED</span>
                </div>
                <div className="space-y-2 font-sans">
                  <div className="space-y-1.5 text-[10px] text-slate-300">
                    <div className="flex items-center justify-between p-1 hover:bg-white/[0.02] rounded transition-colors">
                      <span className="text-[#94a3b8] font-medium">Save Buffer State</span>
                      <span className="bg-[#121220]/60 px-2 py-0.5 rounded border border-[#d8b4fe]/25 text-[#ffffff] font-sans font-semibold text-[9px]">Ctrl + S</span>
                    </div>
                    <div className="flex items-center justify-between p-1 hover:bg-white/[0.02] rounded transition-colors">
                      <span className="text-[#94a3b8] font-medium">Step Backward (Undo)</span>
                      <span className="bg-[#121220]/60 px-2 py-0.5 rounded border border-[#d8b4fe]/25 text-[#ffffff] font-sans font-semibold text-[9px]">Ctrl + Z</span>
                    </div>
                    <div className="flex items-center justify-between p-1 hover:bg-white/[0.02] rounded transition-colors">
                      <span className="text-[#94a3b8] font-medium">Search Workspace Buffer</span>
                      <span className="bg-[#121220]/60 px-2 py-0.5 rounded border border-[#d8b4fe]/25 text-[#ffffff] font-sans font-semibold text-[9px]">Ctrl + F</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Panel 2: AST Compile Metrics (md:col-span-1) */}
              <div className="md:col-span-1 bg-[#141423]/50 backdrop-blur-xl rounded-xl border border-[#d8b4fe]/24 p-4 shadow-xl space-y-3 transition-all duration-300 hover:border-[#d8b4fe]/45 hover:shadow-2xl hover:shadow-[#d8b4fe]/5">
                <div className="flex items-center justify-between border-b border-white/[0.04] pb-2">
                  <span className="text-[9px] font-bold tracking-widest text-[#ffffff] font-sans uppercase active-hud-glow">
                    AST Compile
                  </span>
                  <span className="glowing-indicator green" />
                </div>
                <div className="space-y-2 font-sans">
                  <div className="space-y-1.5 text-[10px] text-slate-350">
                    <div className="flex items-center justify-between">
                      <span className="text-[#94a3b8] font-medium">Syllabus Guard</span>
                      <span className="text-emerald-400 font-bold text-[9px] tracking-wider active-hud-glow">NOMINAL</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[#94a3b8] font-medium">Parser Ingestion</span>
                      <span className="text-amber-400 font-bold text-[9px] tracking-wider active-hud-glow">ZERO_LOOP</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[#94a3b8] font-medium">Thread Lock</span>
                      <span className="text-[#ffffff] font-bold text-[9px] tracking-wide">ACTIVE</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Panel 3: Syllabus Milestones / Task Checklists (md:col-span-full) */}
              <div className="md:col-span-full bg-[#141423]/50 backdrop-blur-xl rounded-xl border border-[#d8b4fe]/24 p-4 shadow-xl space-y-3 transition-all duration-300 hover:border-[#d8b4fe]/45 hover:shadow-2xl hover:shadow-[#d8b4fe]/5">
                <div className="flex items-center justify-between border-b border-white/[0.04] pb-2">
                  <span className="text-[9px] font-bold tracking-widest text-[#ffffff] font-sans uppercase active-hud-glow">
                    Active Syllabus Milestones & Checklists
                  </span>
                  <span className="text-[8px] text-[#94a3b8] font-sans tracking-wide">PHASE_01_INGESTION</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[10px] font-sans">
                  <div className="bg-[#121220]/45 border border-[#d8b4fe]/25 p-2.5 rounded-lg text-center transition-all hover:bg-white/[0.03] hover:border-[#d8b4fe]/45 active-hud-glow">
                    <span className="block text-[#94a3b8] uppercase text-[8px] tracking-widest mb-0.5 font-bold">Week 01 - ACTIVE</span>
                    <span className="text-[#ffffff] font-bold block truncate">Recursive Integrations</span>
                  </div>
                  <div className="bg-white/[0.01] border border-white/[0.03] p-2.5 rounded-lg text-center transition-all hover:bg-white/[0.03] opacity-60">
                    <span className="block text-[#94a3b8] uppercase text-[8px] tracking-wider mb-0.5 font-medium">Week 02 - LOCKED</span>
                    <span className="text-slate-400 font-medium block truncate">Pointers & Structural Memory</span>
                  </div>
                  <div className="bg-white/[0.01] border border-white/[0.03] p-2.5 rounded-lg text-center transition-all hover:bg-white/[0.03] opacity-60">
                    <span className="block text-[#94a3b8] uppercase text-[8px] tracking-wider mb-0.5 font-medium">Week 03 - LOCKED</span>
                    <span className="text-slate-400 font-medium block truncate">Abstract Data Structures</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="text-center text-[10px] text-slate-500 font-sans tracking-wide pt-2 border-t border-white/[0.02]">
              Select a file from the explorer sidebar to begin coding.
            </div>
          </div>
        </div>
      </div>
    );
  }

  const displayFilename = activeFile.split('/').pop() || activeFile;

  return (
    <div 
      aria-label="Core Code Editor"
      className="w-full h-full flex flex-col bg-transparent text-slate-200 font-mono"
    >
      {/* Upper Metadata Telemetry Header Row */}
      <div className="flex items-center justify-between px-4 py-2 bg-neutral-950/40 border-b border-white/[0.04]">
        <div className="text-xs font-bold text-[#ffffff] tracking-widest uppercase font-sans active-hud-glow">
          Core Viewport
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[#ffffff] font-mono tracking-tight uppercase">
            {displayFilename}
          </span>
          <span className={`glowing-indicator ${telemetryErrors.length > 0 ? 'red' : 'green'}`} />
        </div>
      </div>
      
      {/* Code Container */}
      <div ref={editorRef} className="flex-1 overflow-auto text-sm leading-relaxed p-2" />
    </div>
  );
};
