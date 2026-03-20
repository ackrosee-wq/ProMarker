import React from 'react';
import {
  MousePointer,
  Pen,
  Square,
  Circle,
  Type,
  StickyNote,
  Eraser,
  Lasso,
  ZoomIn,
  ZoomOut,
  Grid3X3,
  Undo,
  Redo,
  Send,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Tooltip } from '../ui/Tooltip';
import { useIdeaBoardStore } from '../../store/ideaboard-store';

type ToolId = 'select' | 'pen' | 'rectangle' | 'circle' | 'text' | 'sticky' | 'eraser' | 'lasso';

interface ToolDef {
  id: ToolId;
  label: string;
  icon: LucideIcon;
}

const tools: ToolDef[] = [
  { id: 'select', label: 'Select (V)', icon: MousePointer },
  { id: 'pen', label: 'Pen (P)', icon: Pen },
  { id: 'rectangle', label: 'Rectangle (R)', icon: Square },
  { id: 'circle', label: 'Circle (C)', icon: Circle },
  { id: 'text', label: 'Text (T)', icon: Type },
  { id: 'sticky', label: 'Sticky Note (S)', icon: StickyNote },
  { id: 'eraser', label: 'Eraser (E)', icon: Eraser },
  { id: 'lasso', label: 'Lasso (L)', icon: Lasso },
];

interface ToolbarProps {
  onUndo: () => void;
  onRedo: () => void;
  onPushToAE: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  onUndo,
  onRedo,
  onPushToAE,
  canUndo,
  canRedo,
}) => {
  const activeTool = useIdeaBoardStore((s) => s.activeTool);
  const setTool = useIdeaBoardStore((s) => s.setTool);
  const zoom = useIdeaBoardStore((s) => s.zoom);
  const setZoom = useIdeaBoardStore((s) => s.setZoom);
  const showGrid = useIdeaBoardStore((s) => s.showGrid);
  const toggleGrid = useIdeaBoardStore((s) => s.toggleGrid);

  const handleZoomIn = () => {
    setZoom(Math.min(zoom + 0.1, 5));
  };

  const handleZoomOut = () => {
    setZoom(Math.max(zoom - 0.1, 0.1));
  };

  const zoomPercent = Math.round(zoom * 100);

  return (
    <div className="flex items-center gap-0.5 px-2 py-1 bg-[#252525] border-b border-white/[0.06] shrink-0">
      {/* Tool buttons */}
      {tools.map((tool) => {
        const Icon = tool.icon;
        const isActive = activeTool === tool.id;
        return (
          <Tooltip key={tool.id} content={tool.label}>
            <button
              onClick={() => setTool(tool.id)}
              className={`
                flex items-center justify-center w-7 h-7 rounded-md transition-colors duration-100
                ${
                  isActive
                    ? 'bg-[#5b9fd6]/25 text-[#5b9fd6]'
                    : 'text-[#d8d8d8]/50 hover:text-[#d8d8d8]/80 hover:bg-white/[0.06]'
                }
              `}
            >
              <Icon size={14} />
            </button>
          </Tooltip>
        );
      })}

      {/* Separator */}
      <div className="w-px h-4 bg-white/[0.08] mx-1" />

      {/* Zoom controls */}
      <Tooltip content="Zoom Out">
        <button
          onClick={handleZoomOut}
          className="flex items-center justify-center w-7 h-7 rounded-md text-[#d8d8d8]/50 hover:text-[#d8d8d8]/80 hover:bg-white/[0.06] transition-colors"
        >
          <ZoomOut size={14} />
        </button>
      </Tooltip>

      <span className="text-[9px] text-[#d8d8d8]/40 font-mono min-w-[32px] text-center select-none">
        {zoomPercent}%
      </span>

      <Tooltip content="Zoom In">
        <button
          onClick={handleZoomIn}
          className="flex items-center justify-center w-7 h-7 rounded-md text-[#d8d8d8]/50 hover:text-[#d8d8d8]/80 hover:bg-white/[0.06] transition-colors"
        >
          <ZoomIn size={14} />
        </button>
      </Tooltip>

      {/* Separator */}
      <div className="w-px h-4 bg-white/[0.08] mx-1" />

      {/* Grid toggle */}
      <Tooltip content={showGrid ? 'Hide Grid' : 'Show Grid'}>
        <button
          onClick={toggleGrid}
          className={`
            flex items-center justify-center w-7 h-7 rounded-md transition-colors duration-100
            ${
              showGrid
                ? 'bg-white/[0.08] text-[#d8d8d8]/80'
                : 'text-[#d8d8d8]/50 hover:text-[#d8d8d8]/80 hover:bg-white/[0.06]'
            }
          `}
        >
          <Grid3X3 size={14} />
        </button>
      </Tooltip>

      {/* Undo / Redo */}
      <Tooltip content="Undo (Ctrl+Z)">
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className="flex items-center justify-center w-7 h-7 rounded-md text-[#d8d8d8]/50 hover:text-[#d8d8d8]/80 hover:bg-white/[0.06] transition-colors disabled:opacity-25 disabled:hover:bg-transparent"
        >
          <Undo size={14} />
        </button>
      </Tooltip>

      <Tooltip content="Redo (Ctrl+Shift+Z)">
        <button
          onClick={onRedo}
          disabled={!canRedo}
          className="flex items-center justify-center w-7 h-7 rounded-md text-[#d8d8d8]/50 hover:text-[#d8d8d8]/80 hover:bg-white/[0.06] transition-colors disabled:opacity-25 disabled:hover:bg-transparent"
        >
          <Redo size={14} />
        </button>
      </Tooltip>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Push to AE */}
      <Tooltip content="Push to After Effects">
        <button
          onClick={onPushToAE}
          className="flex items-center gap-1.5 px-2.5 h-7 rounded-md bg-[#5b9fd6]/15 text-[#5b9fd6] text-[10px] font-medium hover:bg-[#5b9fd6]/25 transition-colors"
        >
          <Send size={12} />
          <span className="hidden sm:inline">Push to AE</span>
        </button>
      </Tooltip>
    </div>
  );
};
