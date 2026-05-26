import React, { useEffect, useRef } from 'react';
import { EditorState, StateField, StateEffect, RangeSetBuilder } from '@codemirror/state';
import { EditorView, keymap, drawSelection, Decoration, DecorationSet } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';
import { invoke } from '@tauri-apps/api/core';
import { useWorkspaceStore } from '../store/workspaceStore';
import { TelemetryFault } from '../types/telemetry';

export const setDiagnostics = StateEffect.define<TelemetryFault[]>();

export const diagnosticField = StateField.define<DecorationSet>({
  create() { return Decoration.none; },
  update(underlines, tr) {
    // Dynamic mapping across transactions maintains correct marker coordinates during keystroke changes
    underlines = underlines.map(tr.changes);
    for (const effect of tr.effects) {
      if (effect.is(setDiagnostics)) {
        const errors = effect.value;
        const builder = new RangeSetBuilder<Decoration>();
        
        // RangeSetBuilder strictly requires sorting decorations in ascending document index order
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
            // Defensively swallow bounds mismatch during rapid concurrent typing
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
    backgroundColor: "#050505 !important",
    color: "#94a3b8 !important",
    height: "100%",
  },
  ".cm-content": {
    fontFamily: "'JetBrains Mono', monospace !important",
    fontSize: "13px !important",
  },
  ".cm-gutters": {
    backgroundColor: "#0a0a0a !important",
    color: "#64748b !important",
    borderRight: "1px solid #1e293b !important",
  },
  ".cm-activeLine": {
    backgroundColor: "rgba(255, 255, 255, 0.02) !important",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "rgba(255, 255, 255, 0.05) !important",
    color: "#f8fafc !important",
  },
});

const customHighlightStyle = HighlightStyle.define([
  { tag: t.keyword, color: '#d97706', backgroundColor: 'rgba(217, 119, 6, 0.15)', fontWeight: 'bold' },
  { tag: [t.name, t.deleted, t.character, t.propertyName, t.macroName], color: '#f8fafc' },
  { tag: [t.variableName, t.labelName], color: '#f8fafc' },
  { tag: [t.typeName, t.className, t.number, t.changed], color: '#94a3b8' },
  { tag: [t.comment, t.quote], color: '#64748b', fontStyle: 'italic' },
  { tag: [t.string, t.meta, t.regexp], color: '#94a3b8' },
]);

export const Editor: React.FC = () => {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeFile = useWorkspaceStore((state) => state.activeFile);
  const telemetryErrors = useWorkspaceStore((state) => state.telemetryErrors);

  useEffect(() => {
    if (!editorRef.current) return;

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

            // True trailing-edge client-side debounce loop to prevent IPC flooding
            saveTimeoutRef.current = setTimeout(() => {
              const content = update.state.doc.toString();
              invoke('save_file_content', { content }).catch(console.error);
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
  }, []);

  useEffect(() => {
    if (activeFile && viewRef.current) {
      invoke<string>('load_file_content', { path: activeFile })
        .then((content) => {
          if (viewRef.current) {
            viewRef.current.dispatch({
              changes: { from: 0, to: viewRef.current.state.doc.length, insert: content },
            });
          }
        })
        .catch(console.error);
    }
  }, [activeFile]);

  // Push telemetry adjustments down into the editor state field via thread-safe effects
  useEffect(() => {
    if (viewRef.current) {
      viewRef.current.dispatch({
        effects: setDiagnostics.of(telemetryErrors),
      });
    }
  }, [telemetryErrors]);

  return (
    <div className="w-full h-full flex flex-col bg-neutral-950 text-neutral-200 font-mono">
      <div className="p-2 text-xs font-semibold text-neutral-400 border-b border-neutral-800 uppercase tracking-wider">
        CS-SCHOLAR-TELEMETRY // Core Workspace Viewport
      </div>
      <div ref={editorRef} className="flex-1 overflow-auto text-sm leading-relaxed" />
    </div>
  );
};
