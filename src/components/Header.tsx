import React from 'react';
import { Bookmark, Settings, RefreshCw } from 'lucide-react';
import { useAppStore } from '../store/app-store';
import { useMarkerStore } from '../store/marker-store';
import { debugLogger } from '../lib/debug-logger';

interface HeaderProps {
  onOpenSettings: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenSettings }) => {
  const version = useAppStore((s) => s.version);
  const forceReload = useMarkerStore((s) => s.forceReload);

  const handleReload = () => {
    debugLogger.info('Header', 'Force reload triggered');
    forceReload();
  };

  return (
    <header className="flex items-center justify-between h-8 px-2.5 bg-[#232323] border-b border-[#3a3a3a] shrink-0 select-none">
      {/* Left: icon + title + version */}
      <div className="flex items-center gap-1.5">
        <Bookmark size={13} className="text-[#4a9eff] shrink-0" />
        <span className="text-[11px] font-semibold text-[#e0e0e0]">ProMarker</span>
        <span className="text-[9px] text-[#555]">v{version}</span>
      </div>

      {/* Right: settings + reload */}
      <div className="flex items-center gap-0.5">
        <button
          onClick={onOpenSettings}
          className="flex items-center justify-center w-6 h-6 rounded text-[#888] hover:text-[#e0e0e0] hover:bg-[#2a2a2a] transition-[color,background] duration-[120ms]"
        >
          <Settings size={14} />
        </button>
        <button
          onClick={handleReload}
          className="flex items-center justify-center w-6 h-6 rounded text-[#888] hover:text-[#e0e0e0] hover:bg-[#2a2a2a] transition-[color,background] duration-[120ms]"
        >
          <RefreshCw size={13} />
        </button>
      </div>
    </header>
  );
};
