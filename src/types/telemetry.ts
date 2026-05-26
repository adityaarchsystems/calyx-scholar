export type FileCategory = 'note' | 'assessment' | 'source_code' | 'unknown';

export interface TelemetryFault {
  sourceFile: string;
  lineNumber: number;
  column: number;
  severity: 'error' | 'warning';
  message: string;
  faultCategory: string;
}

export interface WorkspaceEvent {
  timestamp: number;
  filePath: string;
  category: FileCategory;
  relativePath: string;
}

export interface AgentContextPayload {
  event: WorkspaceEvent;
  activeWeek: number;
  courseId: string;
  prohibitedTokens: string[];
  faultVector: TelemetryFault | null;
}
