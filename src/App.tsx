import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { NavBar } from './components/NavBar';
import { MarkerList } from './components/MarkerList';
import { IdeaBoard } from './components/IdeaBoard/IdeaBoard';
import { SettingsPanel } from './components/Settings/SettingsPanel';
import { useAppStore } from './store/app-store';
import { useMarkerStore } from './store/marker-store';
import { cepBridge } from './bridge/cep-bridge';
import { storage } from './lib/storage';
import { debugLogger } from './lib/debug-logger';

export const App: React.FC = () => {
  const currentView = useAppStore((s) => s.currentView);
  const version = useAppStore((s) => s.version);
  const setConnected = useAppStore((s) => s.setConnected);
  const setProjectInfo = useAppStore((s) => s.setProjectInfo);
  const syncFromPremiere = useMarkerStore((s) => s.syncFromPremiere);
  const loadFromStorage = useMarkerStore((s) => s.loadFromStorage);
  const selectedMarkerId = useMarkerStore((s) => s.selectedMarkerId);
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const initializedRef = useRef(false);

  // Initialize everything on mount
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    // Init debug logger with extension path
    const extPath = cepBridge.getExtensionPath();
    debugLogger.init(extPath || undefined);
    debugLogger.info('App', 'ProMarker starting up');

    // Listen for connected event BEFORE calling init
    cepBridge.on('connected', async () => {
      debugLogger.info('App', 'Bridge connected');
      setConnected(true);

      // Get project info and init storage
      const info = await cepBridge.getProjectInfo();
      if (info) {
        setProjectInfo(info);
        storage.init(info.projectPath);
        debugLogger.info('App', `Project: ${info.projectName} at ${info.projectPath}`);

        // Load saved markers from disk
        await loadFromStorage();
      }

      // Sync markers from Premiere
      await syncFromPremiere();
    });

    // Init the bridge (this triggers 'connected' asynchronously)
    cepBridge.init();
  }, [setConnected, setProjectInfo, syncFromPremiere, loadFromStorage]);

  // Poll markers every 2 seconds
  useEffect(() => {
    syncIntervalRef.current = setInterval(() => {
      syncFromPremiere();
    }, 2000);

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
        syncIntervalRef.current = null;
      }
    };
  }, [syncFromPremiere]);

  return (
    <div className="flex flex-col h-screen bg-bg overflow-hidden">
      {/* Top header bar */}
      <header className="flex items-center justify-between px-3 py-1.5 border-b border-white/[0.06] shrink-0">
        <span className="text-[10px] font-semibold text-fg/50 tracking-wide">
          ProMarker
        </span>
        <span className="text-[9px] text-fg/25 font-mono">
          v{version}
        </span>
      </header>

      {/* Main content area */}
      <div className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait">
          {currentView === 'markers' && (
            <motion.div
              key="markers"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.15 }}
              className="absolute inset-0"
            >
              <MarkerList />
            </motion.div>
          )}

          {currentView === 'ideaboard' && (
            <motion.div
              key="ideaboard"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.15 }}
              className="absolute inset-0"
            >
              <IdeaBoard markerId={selectedMarkerId} />
            </motion.div>
          )}

          {currentView === 'settings' && (
            <motion.div
              key="settings"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.15 }}
              className="absolute inset-0"
            >
              <SettingsPanel />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom navigation */}
      <NavBar />
    </div>
  );
};
