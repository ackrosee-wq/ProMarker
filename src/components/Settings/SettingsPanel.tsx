import React, { useState } from 'react';
import { FolderOpen, Bug, RefreshCw, Info } from 'lucide-react';
import { useAppStore } from '../../store/app-store';
import { useMarkerStore } from '../../store/marker-store';
import { cepBridge } from '../../bridge/cep-bridge';

export const SettingsPanel: React.FC = () => {
  const projectInfo = useAppStore((s) => s.projectInfo);
  const version = useAppStore((s) => s.version);
  const forceReload = useMarkerStore((s) => s.forceReload);
  const [autoSync, setAutoSync] = useState(true);

  const openProMarkerFolder = () => {
    if (projectInfo?.promarkerDir) {
      cepBridge.openFolder(projectInfo.promarkerDir);
    }
  };

  const openDebugLogs = () => {
    if (projectInfo?.promarkerDir) {
      cepBridge.openFolder(projectInfo.promarkerDir + '/Logs');
    }
  };

  return (
    <div className="flex flex-col gap-3 p-3 overflow-y-auto h-full pb-16">
      {/* Project Info */}
      <section className="bg-[#252525] rounded-lg p-3">
        <h3 className="text-[10px] font-semibold text-[#d8d8d8]/50 uppercase tracking-wider mb-2">
          Project
        </h3>
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-[#d8d8d8]/60">Name</span>
            <span className="text-[11px] text-[#d8d8d8] truncate ml-4 max-w-[60%] text-right">
              {projectInfo?.projectName || 'Not connected'}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-[#d8d8d8]/60">Path</span>
            <span className="text-[10px] text-[#d8d8d8]/40 truncate ml-4 max-w-[60%] text-right" title={projectInfo?.projectPath}>
              {projectInfo?.projectPath || '--'}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-[#d8d8d8]/60">ProMarker Folder</span>
            <span className="text-[10px] text-[#d8d8d8]/40 truncate ml-4 max-w-[60%] text-right" title={projectInfo?.promarkerDir}>
              {projectInfo?.promarkerDir || '--'}
            </span>
          </div>
        </div>
      </section>

      {/* Preferences */}
      <section className="bg-[#252525] rounded-lg p-3">
        <h3 className="text-[10px] font-semibold text-[#d8d8d8]/50 uppercase tracking-wider mb-2">
          Preferences
        </h3>
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-[#d8d8d8]">Auto-sync markers</span>
          <button
            onClick={() => setAutoSync(!autoSync)}
            className={`
              relative w-8 h-[18px] rounded-full transition-colors duration-200
              ${autoSync ? 'bg-[#5b9fd6]' : 'bg-white/15'}
            `}
          >
            <div
              className={`
                absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white transition-transform duration-200
                ${autoSync ? 'left-[16px]' : 'left-[2px]'}
              `}
            />
          </button>
        </div>
      </section>

      {/* Actions */}
      <section className="bg-[#252525] rounded-lg p-3">
        <h3 className="text-[10px] font-semibold text-[#d8d8d8]/50 uppercase tracking-wider mb-2">
          Actions
        </h3>
        <div className="flex flex-col gap-1.5">
          <button
            onClick={forceReload}
            className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg hover:bg-white/[0.06] transition-colors duration-150 text-left"
          >
            <RefreshCw size={13} className="text-[#d8d8d8]/50 shrink-0" />
            <span className="text-[11px]">Force Reload Markers</span>
          </button>
          <button
            onClick={openDebugLogs}
            className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg hover:bg-white/[0.06] transition-colors duration-150 text-left"
          >
            <Bug size={13} className="text-[#d8d8d8]/50 shrink-0" />
            <span className="text-[11px]">Open Debug Logs</span>
          </button>
          <button
            onClick={openProMarkerFolder}
            className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg hover:bg-white/[0.06] transition-colors duration-150 text-left"
          >
            <FolderOpen size={13} className="text-[#d8d8d8]/50 shrink-0" />
            <span className="text-[11px]">Open ProMarker Folder</span>
          </button>
        </div>
      </section>

      {/* About */}
      <section className="bg-[#252525] rounded-lg p-3">
        <h3 className="text-[10px] font-semibold text-[#d8d8d8]/50 uppercase tracking-wider mb-2">
          About
        </h3>
        <div className="flex items-center gap-2">
          <Info size={14} className="text-[#5b9fd6] shrink-0" />
          <div>
            <p className="text-[11px] text-[#d8d8d8] font-medium">ProMarker</p>
            <p className="text-[10px] text-[#d8d8d8]/40">Version {version}</p>
          </div>
        </div>
      </section>
    </div>
  );
};
