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
          <div className="text-xs font-semibold text-[#d8b4fe]/80 tracking-widest uppercase font-sans">
            Core Viewport
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-500 font-mono tracking-tight uppercase">
              NO_FILE_LOADED
            </span>
            <span className="glowing-indicator green" />
          </div>
        </div>

        {/* Welcome Grid Content */}
        <div className="flex-1 flex flex-col items-center justify-center py-6 relative">
          {/* Circular Brand Logo Emblem with soft opacity */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03] transition-opacity duration-700">
            <img 
              src={logoSrc} 
              alt="Scholastic Emblem Logo" 
              className="w-72 h-72 object-contain rounded-full border border-[#d8b4fe]/10 p-2"
              onError={() => setLogoSrc('/logo.png')}
            />
          </div>

          <div className="relative z-10 max-w-lg w-full space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-xl font-bold text-slate-200 tracking-wide font-sans">
                Welcome to Calyx Scholar
              </h2>
              <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                A decoupled, pedagogical IDE designed to assist novice developers through guided active learning logic.
              </p>
            </div>

            {/* Typography shortcuts & Telemetry grid card */}
            <div className="bg-[#161626]/40 backdrop-blur-xl rounded-2xl border border-white/[0.03] p-5 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-white/[0.04] pb-3">
                <span className="text-[9px] font-semibold tracking-widest text-[#d8b4fe]/80 font-sans uppercase">
                  Command Systems
                </span>
                <span className="text-[9px] text-slate-500 font-mono">0x4F0B_NOMINAL</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Keyboard shortcuts list */}
                <div className="space-y-2 font-sans">
                  <div className="text-xs font-semibold text-slate-300 tracking-wide">
                    Keyboard Shortcuts
                  </div>
                  <div className="space-y-1.5 text-[10px] text-slate-400">
                    <div className="flex items-center justify-between">
                      <span>Telemetry Save</span>
                      <span className="bg-white/5 px-1.5 py-0.5 rounded border border-white/10 text-slate-205 font-mono">Ctrl + S</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Incremental Undo</span>
                      <span className="bg-white/5 px-1.5 py-0.5 rounded border border-white/10 text-slate-205 font-mono">Ctrl + Z</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Buffer Search</span>
                      <span className="bg-white/5 px-1.5 py-0.5 rounded border border-white/10 text-slate-205 font-mono">Ctrl + F</span>
                    </div>
                  </div>
                </div>

                {/* Telemetry states */}
                <div className="space-y-2 border-l border-white/[0.04] pl-4 font-sans">
                  <div className="text-xs font-semibold text-slate-300 tracking-wide">
                    Telemetry Indicators
                  </div>
                  <div className="space-y-1.5 text-[10px] text-slate-400">
                    <div className="flex items-center justify-between">
                      <span>Circular Buffer</span>
                      <span className="text-emerald-500 font-bold font-mono">NOMINAL</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>AST Syntax Guard</span>
                      <span className="text-amber-500 font-bold font-mono">ZERO_LOOP</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Ingestion Engine</span>
                      <span className="text-slate-200 font-bold">ACTIVE</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Syllabus Milestones */}
              <div className="border-t border-white/[0.04] pt-3.5 space-y-2 font-sans">
                <div className="text-xs font-semibold text-slate-300 tracking-wide">
                  Upcoming Syllabus Milestones
                </div>
                <div className="grid grid-cols-3 gap-2 text-[10px]">
                  <div className="bg-white/[0.01] border border-white/[0.03] p-2 rounded-xl text-center">
                    <span className="block text-slate-500 uppercase font-mono text-[8px] tracking-tight">Week 01</span>
                    <span className="text-slate-300 font-medium truncate block">Recursive Logic</span>
                  </div>
                  <div className="bg-white/[0.01] border border-white/[0.03] p-2 rounded-xl text-center">
                    <span className="block text-slate-500 uppercase font-mono text-[8px] tracking-tight">Week 02</span>
                    <span className="text-slate-300 font-medium truncate block">Pointers & Memory</span>
                  </div>
                  <div className="bg-white/[0.01] border border-white/[0.03] p-2 rounded-xl text-center text-slate-500">
                    <span className="block text-slate-600 uppercase font-mono text-[8px] tracking-tight">Week 03</span>
                    <span className="font-medium truncate block">Database Schemas</span>
                  </div>
                </div>
              </div>

              <div className="text-center text-[10px] text-slate-500 font-sans tracking-wide pt-2 border-t border-white/[0.02]">
                Select a file from the explorer sidebar to begin coding.
              </div>
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
        <div className="text-xs font-semibold text-[#d8b4fe]/80 tracking-widest uppercase font-sans">
          Core Viewport
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-400 font-mono tracking-tight uppercase">
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
