import React, { useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { NavBar } from './components/NavBar';
import { MarkerList } from './components/MarkerList';
import { IdeaBoard } from './components/IdeaBoard/IdeaBoard';
import { SettingsPanel } from './components/Settings/SettingsPanel';
import { useAppStore } from './store/app-store';
import { useMarkerStore } from './store/marker-store';
import { cepBridge } from './bridge/cep-bridge';

export const App: React.FC = () => {
  const currentView = useAppStore((s) => s.currentView);
  const connected = useAppStore((s) => s.connected);
  const version = useAppStore((s) => s.version);
  const setConnected = useAppStore((s) => s.setConnected);
  const setProjectInfo = useAppStore((s) => s.setProjectInfo);
  const syncFromPremiere = useMarkerStore((s) => s.syncFromPremiere);
  const selectedMarkerId = useMarkerStore((s) => s.selectedMarkerId);
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Initialize bridge on mount
  useEffect(() => {
    const initBridge = async () => {
      try {
        await cepBridge.init();

        cepBridge.on('connected', (info) => {
          setConnected(true);
          if (info) {
            setProjectInfo(info);
          }
        });

        cepBridge.on('disconnected', () => {
          setConnected(false);
        });

        // Check if already connected
        const info = await cepBridge.getProjectInfo();
        if (info) {
          setConnected(true);
          setProjectInfo(info);
        }
      } catch {
        // Running outside CEP (dev mode), mock as connected
        setConnected(true);
      }
    };

    initBridge();
  }, [setConnected, setProjectInfo]);

  // Poll markers every 1 second when connected
  useEffect(() => {
    if (connected) {
      // Initial sync
      syncFromPremiere();

      syncIntervalRef.current = setInterval(() => {
        syncFromPremiere();
      }, 1000);
    }

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
        syncIntervalRef.current = null;
      }
    };
  }, [connected, syncFromPremiere]);

  // Loading state
  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[#1e1e1e]">
        <Loader2 size={24} className="text-[#5b9fd6] animate-spin mb-3" />
        <p className="text-[11px] text-[#d8d8d8]/50">Connecting to Premiere Pro...</p>
        <p className="text-[9px] text-[#d8d8d8]/25 mt-1">Make sure a project is open</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-[#1e1e1e] overflow-hidden">
      {/* Top header bar */}
      <header className="flex items-center justify-between px-3 py-1.5 border-b border-white/[0.06] shrink-0">
        <span className="text-[10px] font-semibold text-[#d8d8d8]/50 tracking-wide">
          ProMarker
        </span>
        <span className="text-[9px] text-[#d8d8d8]/25 font-mono">
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
