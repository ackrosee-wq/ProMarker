// ProMarker App Store
// Global application state: navigation, connection status, project info.

import { create } from 'zustand';
import type { NavView, ProjectInfo } from '../types';

interface AppState {
  currentView: NavView;
  connected: boolean;
  projectInfo: ProjectInfo | null;
  version: string;

  // Actions
  setView: (view: NavView) => void;
  setConnected: (connected: boolean) => void;
  setProjectInfo: (info: ProjectInfo | null) => void;
  setVersion: (version: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentView: 'markers',
  connected: false,
  projectInfo: null,
  version: '1.0.1',

  setView: (view) => set({ currentView: view }),

  setConnected: (connected) => set({ connected }),

  setProjectInfo: (info) => set({ projectInfo: info }),

  setVersion: (version) => set({ version }),
}));
