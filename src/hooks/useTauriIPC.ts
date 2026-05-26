import { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { useWorkspaceStore } from '../store/workspaceStore';
import { AgentContextPayload } from '../types/telemetry';

export const useTauriIPC = () => {
  const { setTelemetryErrors, handleStreamViolation, setSyllabusConstraints } = useWorkspaceStore();

  useEffect(() => {
    // Bind async listener to native Rust file-watcher orchestration channel
    const unlistenTelemetry = listen<AgentContextPayload>('cs-scholar-telemetry', (event) => {
      const payload = event.payload;
      
      if (payload.faultVector) {
        setTelemetryErrors([payload.faultVector]);
      } else {
        setTelemetryErrors([]);
      }

      setSyllabusConstraints(payload.activeWeek, payload.prohibitedTokens);
    });

    // Bind async listener to native Socratic validation guardrail channel
    const unlistenViolation = listen<void>('socratic-violation', () => {
      handleStreamViolation();
    });

    // Cleanup hook paths safely to prevent active channel event leakage
    return () => {
      unlistenTelemetry.then((f) => f());
      unlistenViolation.then((f) => f());
    };
  }, [setTelemetryErrors, handleStreamViolation, setSyllabusConstraints]);
};
