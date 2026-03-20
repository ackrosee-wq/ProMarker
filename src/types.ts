export interface ProMarker {
  id: string;
  name: string;
  time: number;
  duration: number;
  color: string;
  checked: boolean;
  notes: string;
  attachments: Attachment[];
  ideaBoardData: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface Attachment {
  id: string;
  type: 'image' | 'video' | 'url' | 'file' | '3d-model';
  name: string;
  path: string;
  thumbnail?: string;
  metadata?: Record<string, unknown>;
}

export interface StickyNote {
  id: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

export interface IdeaBoardState {
  canvasJSON: string;
  stickyNotes: StickyNote[];
  zoom: number;
  panX: number;
  panY: number;
}

export interface ProjectInfo {
  projectPath: string;
  projectName: string;
  promarkerDir: string;
}

export type NavView = 'markers' | 'ideaboard' | 'settings';

export interface DebugLogEntry {
  timestamp: number;
  version: string;
  action: string;
  details: string;
  level: 'info' | 'warn' | 'error';
}
