import React, { useState, useRef, useCallback } from 'react';
import { ChevronDown, Paintbrush, Paperclip, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Checkbox } from './ui/Checkbox';
import { AttachmentPanel } from './Attachments/AttachmentPanel';
import { useMarkerStore } from '../store/marker-store';
import { cepBridge } from '../bridge/cep-bridge';
import { debugLogger } from '../lib/debug-logger';
import type { ProMarker } from '../types';

interface MarkerItemProps {
  marker: ProMarker;
  onOpenIdeaBoard: () => void;
}

const MARKER_COLORS: Record<string, string> = {
  green: '#4caf50',
  red: '#f44336',
  purple: '#9c27b0',
  orange: '#ff9800',
  yellow: '#ffeb3b',
  white: '#e0e0e0',
  blue: '#4a9eff',
  cyan: '#00bcd4',
};

function formatTimecode(t: number): string {
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = Math.floor(t % 60);
  const f = Math.floor((t % 1) * 30);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}:${String(f).padStart(2, '0')}`;
}

export const MarkerItem: React.FC<MarkerItemProps> = ({ marker, onOpenIdeaBoard }) => {
  const [expanded, setExpanded] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(marker.name);
  const [notesValue, setNotesValue] = useState(marker.notes);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const selectedMarkerId = useMarkerStore((s) => s.selectedMarkerId);
  const setSelectedMarker = useMarkerStore((s) => s.setSelectedMarker);
  const toggleChecked = useMarkerStore((s) => s.toggleChecked);
  const updateMarker = useMarkerStore((s) => s.updateMarker);
  const removeMarker = useMarkerStore((s) => s.removeMarker);

  const isSelected = selectedMarkerId === marker.id;
  const colorHex = MARKER_COLORS[marker.color] || MARKER_COLORS.blue;

  // Click marker → select it AND seek to its time in Premiere
  const handleClick = useCallback(() => {
    setSelectedMarker(marker.id);
    cepBridge.seekToTime(marker.time);
    debugLogger.info('MarkerItem', `Seek to ${formatTimecode(marker.time)} for "${marker.name}"`);
  }, [marker.id, marker.time, marker.name, setSelectedMarker]);

  const handleToggleExpand = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded((prev) => !prev);
  }, []);

  const handleDoubleClickName = useCallback(() => {
    setEditingName(true);
    setNameValue(marker.name);
    setTimeout(() => nameInputRef.current?.focus(), 0);
  }, [marker.name]);

  const handleNameCommit = useCallback(() => {
    setEditingName(false);
    if (nameValue.trim() && nameValue !== marker.name) {
      updateMarker(marker.id, { name: nameValue.trim() });
    } else {
      setNameValue(marker.name);
    }
  }, [nameValue, marker.name, marker.id, updateMarker]);

  const handleNameKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleNameCommit();
      else if (e.key === 'Escape') {
        setEditingName(false);
        setNameValue(marker.name);
      }
    },
    [handleNameCommit, marker.name]
  );

  const handleNotesChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const val = e.target.value;
      setNotesValue(val);
      updateMarker(marker.id, { notes: val });
    },
    [marker.id, updateMarker]
  );

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      removeMarker(marker.id);
    },
    [marker.id, removeMarker]
  );

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -60 }}
      transition={{ duration: 0.18 }}
      onClick={handleClick}
      className={`
        group relative rounded-lg overflow-hidden cursor-pointer
        transition-[background,border-color] duration-100
        ${isSelected
          ? 'bg-[#2a2a2a] ring-1 ring-[#4a9eff44]'
          : 'bg-[#252525] hover:bg-[#2a2a2a]'
        }
      `}
    >
      {/* Main row */}
      <div className="flex items-center gap-1.5 px-2 py-[6px]">
        {/* Checkbox */}
        <Checkbox
          checked={marker.checked}
          onChange={() => toggleChecked(marker.id)}
          size="sm"
        />

        {/* Color dot */}
        <div
          className="w-[5px] h-[5px] rounded-full shrink-0"
          style={{ backgroundColor: colorHex }}
        />

        {/* Name + timecode */}
        <div className="flex-1 min-w-0">
          {editingName ? (
            <input
              ref={nameInputRef}
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              onBlur={handleNameCommit}
              onKeyDown={handleNameKeyDown}
              className="w-full h-5 text-[11px] bg-[#1e1e1e] border border-[#4a9eff] rounded px-1.5 outline-none text-[#e0e0e0]"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <p
              className={`text-[11px] leading-tight truncate ${
                marker.checked ? 'line-through text-[#666]' : 'text-[#e0e0e0]'
              }`}
              onDoubleClick={handleDoubleClickName}
            >
              {marker.name || 'Untitled'}
            </p>
          )}
          <p className="text-[9px] text-[#555] font-mono mt-px">{formatTimecode(marker.time)}</p>
        </div>

        {/* Indicators */}
        <div className="flex items-center gap-1 shrink-0">
          {marker.attachments.length > 0 && (
            <Paperclip size={9} className="text-[#555]" />
          )}
          {marker.ideaBoardData && (
            <Paintbrush size={9} className="text-[#4a9eff]" />
          )}
        </div>

        {/* Delete — visible on hover */}
        <button
          onClick={handleDelete}
          className="shrink-0 w-5 h-5 flex items-center justify-center rounded text-[#555] hover:text-[#f44336] hover:bg-[#f4433622] opacity-0 group-hover:opacity-100 transition-[opacity,color,background] duration-100"
        >
          <Trash2 size={11} />
        </button>

        {/* Expand chevron */}
        <button
          onClick={handleToggleExpand}
          className="shrink-0 w-5 h-5 flex items-center justify-center rounded text-[#555] hover:text-[#e0e0e0] hover:bg-[#333] transition-[color,background] duration-100"
        >
          <ChevronDown
            size={12}
            className={`transition-transform duration-150 ${expanded ? 'rotate-180' : ''}`}
          />
        </button>
      </div>

      {/* Expanded detail */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="px-2 pb-2 pt-0.5">
              {/* Notes */}
              <label className="block text-[9px] font-medium text-[#888] uppercase tracking-wider mb-0.5">
                Notes
              </label>
              <textarea
                value={notesValue}
                onChange={handleNotesChange}
                placeholder="Add notes..."
                rows={2}
                className="w-full text-[10px] bg-[#1e1e1e] border border-[#3a3a3a] rounded-md px-2 py-1.5 resize-none focus:border-[#4a9eff] outline-none text-[#e0e0e0] placeholder:text-[#444] transition-[border-color] duration-100"
                onClick={(e) => e.stopPropagation()}
              />

              {/* Attachments */}
              <AttachmentPanel markerId={marker.id} attachments={marker.attachments} />

              {/* Open Idea Board */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenIdeaBoard();
                }}
                className="mt-1.5 w-full h-6 flex items-center justify-center gap-1 rounded-md bg-[#4a9eff15] text-[#4a9eff] text-[10px] font-medium hover:bg-[#4a9eff25] active:scale-[0.97] transition-[background,transform] duration-100"
              >
                <Paintbrush size={11} />
                Open Idea Board
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
