import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { Header } from './components/Header';
import { MarkerList } from './components/MarkerList';
import { IdeaBoard } from './components/IdeaBoard/IdeaBoard';
import { SettingsDialog } from './components/SettingsDialog';
import { useAppStore } from './store/app-store';
import { useMarkerStore } from './store/marker-store';
import { cepBridge } from './bridge/cep-bridge';
import { storage } from './lib/storage';
import { debugLogger } from './lib/debug-logger';

export const App: React.FC = () => {
  const setConnected = useAppStore((s) => s.setConnected);
  const setProjectInfo = useAppStore((s) => s.setProjectInfo);
  const syncFromPremiere = useMarkerStore((s) => s.syncFromPremiere);
  const loadFromStorage = useMarkerStore((s) => s.loadFromStorage);

  const [ideaBoardMarkerId, setIdeaBoardMarkerId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const initializedRef = useRef(false);

  // Initialize everything on mount
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const extPath = cepBridge.getExtensionPath();
    debugLogger.init(extPath || undefined);
    debugLogger.info('App', 'ProMarker starting up');

    cepBridge.on('connected', async () => {
      debugLogger.info('App', 'Bridge connected');
      setConnected(true);

      const info = await cepBridge.getProjectInfo();
      if (info) {
        setProjectInfo(info);
        storage.init(info.projectPath);
        debugLogger.info('App', `Project: ${info.projectName} at ${info.projectPath}`);
        await loadFromStorage();
      }

      await syncFromPremiere();
    });

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
      }
    };
  }, [syncFromPremiere]);

  return (
    <div className="flex flex-col h-screen bg-[#1e1e1e] overflow-hidden">
      <Header
        onOpenSettings={() => setShowSettings(true)}
      />

      <MarkerList
        onOpenIdeaBoard={(id) => setIdeaBoardMarkerId(id)}
      />

      {/* Idea Board — full-screen overlay */}
      <AnimatePresence>
        {ideaBoardMarkerId && (
          <IdeaBoard
            markerId={ideaBoardMarkerId}
            onClose={() => setIdeaBoardMarkerId(null)}
          />
        )}
      </AnimatePresence>

      {/* Settings — modal dialog */}
      <AnimatePresence>
        {showSettings && (
          <SettingsDialog onClose={() => setShowSettings(false)} />
        )}
      </AnimatePresence>
    </div>
  );
};
