import React from 'react';
import { motion } from 'motion/react';
import { X, FolderOpen, Bug, Info } from 'lucide-react';
import { useAppStore } from '../store/app-store';
import { cepBridge } from '../bridge/cep-bridge';
import { debugLogger } from '../lib/debug-logger';

interface SettingsDialogProps {
  onClose: () => void;
}

export const SettingsDialog: React.FC<SettingsDialogProps> = ({ onClose }) => {
  const projectInfo = useAppStore((s) => s.projectInfo);
  const version = useAppStore((s) => s.version);

  const openProMarkerFolder = () => {
    if (projectInfo?.promarkerDir) {
      cepBridge.openFolder(projectInfo.promarkerDir);
      debugLogger.info('Settings', `Opened folder: ${projectInfo.promarkerDir}`);
    }
  };

  const openDebugLogs = () => {
    const extPath = cepBridge.getExtensionPath();
    if (extPath) {
      cepBridge.openFolder(extPath + '/.debug-logs');
      debugLogger.info('Settings', 'Opened debug logs folder');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-[10000] flex items-center justify-center p-3 bg-black/60"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.15 }}
        className="w-[260px] max-w-[95vw] max-h-[85vh] bg-[#232323] border border-[#3a3a3a] rounded-[10px] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between min-h-[32px] px-3 py-2 border-b border-[#3a3a3a]">
          <span className="text-[11px] font-semibold text-[#e0e0e0]">Settings</span>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-5 h-5 rounded text-[#777] hover:text-[#e0e0e0] hover:bg-[#333] transition-[color,background] duration-100"
          >
            <X size={13} />
          </button>
        </div>

        {/* Content */}
        <div className="px-3 py-2.5 flex-1 overflow-y-auto flex flex-col gap-2.5">
          {/* Project Info */}
          <div>
            <p className="text-[9px] font-medium text-[#888] uppercase tracking-wider mb-1">Project</p>
            <div className="flex flex-col gap-1">
              <div className="flex justify-between">
                <span className="text-[10px] text-[#888]">Name</span>
                <span className="text-[10px] text-[#e0e0e0] truncate ml-3 max-w-[55%] text-right">
                  {projectInfo?.projectName || '--'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[10px] text-[#888]">Path</span>
                <span className="text-[9px] text-[#555] truncate ml-3 max-w-[55%] text-right" title={projectInfo?.projectPath}>
                  {projectInfo?.projectPath || '--'}
                </span>
              </div>
            </div>
          </div>

          <div className="border-t border-[#3a3a3a] pt-2.5" />

          {/* Actions */}
          <div className="flex flex-col gap-1">
            <button
              onClick={openProMarkerFolder}
              className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md hover:bg-[#2a2a2a] transition-[background] duration-100 text-left"
            >
              <FolderOpen size={12} className="text-[#888] shrink-0" />
              <span className="text-[10px] text-[#e0e0e0]">Open ProMarker Folder</span>
            </button>
            <button
              onClick={openDebugLogs}
              className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md hover:bg-[#2a2a2a] transition-[background] duration-100 text-left"
            >
              <Bug size={12} className="text-[#888] shrink-0" />
              <span className="text-[10px] text-[#e0e0e0]">Open Debug Logs</span>
            </button>
          </div>

          <div className="border-t border-[#3a3a3a] pt-2.5" />

          {/* About */}
          <div className="flex items-center gap-2">
            <Info size={13} className="text-[#4a9eff] shrink-0" />
            <div>
              <p className="text-[10px] text-[#e0e0e0] font-medium">ProMarker</p>
              <p className="text-[9px] text-[#555]">Version {version}</p>
            </div>
          </div>

          <p className="text-[9px] text-[#555] text-center mt-1">
            Settings are saved automatically
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
};
