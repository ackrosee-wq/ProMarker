import React, { useState, useRef, useCallback } from 'react';
import {
  ChevronDown,
  GripVertical,
  Paintbrush,
  Paperclip,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Checkbox } from './ui/Checkbox';
import { Badge } from './ui/Badge';
import { AttachmentPanel } from './Attachments/AttachmentPanel';
import { useMarkerStore } from '../store/marker-store';
import { useAppStore } from '../store/app-store';
import type { ProMarker } from '../types';

interface MarkerItemProps {
  marker: ProMarker;
}

function formatTimecode(timeInSeconds: number): string {
  const h = Math.floor(timeInSeconds / 3600);
  const m = Math.floor((timeInSeconds % 3600) / 60);
  const s = Math.floor(timeInSeconds % 60);
  const f = Math.floor((timeInSeconds % 1) * 30); // 30fps assumed
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}:${String(f).padStart(2, '0')}`;
}

export const MarkerItem: React.FC<MarkerItemProps> = ({ marker }) => {
  const [expanded, setExpanded] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(marker.name);
  const [notesValue, setNotesValue] = useState(marker.notes);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const selectedMarkerId = useMarkerStore((s) => s.selectedMarkerId);
  const setSelectedMarker = useMarkerStore((s) => s.setSelectedMarker);
  const toggleChecked = useMarkerStore((s) => s.toggleChecked);
  const updateMarker = useMarkerStore((s) => s.updateMarker);
  const setView = useAppStore((s) => s.setView);

  const isSelected = selectedMarkerId === marker.id;
  const attachmentCount = marker.attachments.length;

  const handleSelect = useCallback(() => {
    setSelectedMarker(marker.id);
  }, [marker.id, setSelectedMarker]);

  const handleToggleExpand = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded((prev) => !prev);
  }, []);

  const handleDoubleClickName = useCallback(() => {
    setEditingName(true);
    setNameValue(marker.name);
    setTimeout(() => nameInputRef.current?.focus(), 0);
  }, [marker.name]);

  const handleNameBlur = useCallback(() => {
    setEditingName(false);
    if (nameValue.trim() && nameValue !== marker.name) {
      updateMarker(marker.id, { name: nameValue.trim() });
    } else {
      setNameValue(marker.name);
    }
  }, [nameValue, marker.name, marker.id, updateMarker]);

  const handleNameKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleNameBlur();
      } else if (e.key === 'Escape') {
        setEditingName(false);
        setNameValue(marker.name);
      }
    },
    [handleNameBlur, marker.name]
  );

  const handleNotesChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const val = e.target.value;
      setNotesValue(val);
      updateMarker(marker.id, { notes: val });
    },
    [marker.id, updateMarker]
  );

  const handleOpenIdeaBoard = useCallback(() => {
    setSelectedMarker(marker.id);
    setView('ideaboard');
  }, [marker.id, setSelectedMarker, setView]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -100 }}
      transition={{ duration: 0.2 }}
      onClick={handleSelect}
      className={`
        relative group rounded-lg overflow-hidden transition-colors duration-100
        bg-[#252525] hover:bg-[#2a2a2a]
        ${isSelected ? 'ring-1 ring-[#5b9fd6]/30' : ''}
      `}
    >
      {/* Selected indicator */}
      {isSelected && (
        <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#5b9fd6] rounded-l-lg" />
      )}

      {/* Main row */}
      <div className="flex items-center gap-2 px-2.5 py-2 pl-3.5">
        {/* Drag handle */}
        <div className="cursor-grab text-[#d8d8d8]/20 hover:text-[#d8d8d8]/40 transition-colors shrink-0 opacity-0 group-hover:opacity-100">
          <GripVertical size={12} />
        </div>

        {/* Checkbox */}
        <Checkbox
          checked={marker.checked}
          onChange={() => toggleChecked(marker.id)}
          size="sm"
        />

        {/* Marker color dot */}
        <div
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: marker.color || '#5b9fd6' }}
        />

        {/* Name + Time */}
        <div className="flex-1 min-w-0">
          {editingName ? (
            <input
              ref={nameInputRef}
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              onBlur={handleNameBlur}
              onKeyDown={handleNameKeyDown}
              className="w-full text-[11px] bg-[#1e1e1e] border border-[#5b9fd6] rounded px-1 py-0 outline-none text-[#d8d8d8]"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <p
              className={`text-[11px] leading-tight truncate cursor-text ${
                marker.checked ? 'line-through text-[#d8d8d8]/40' : 'text-[#d8d8d8]'
              }`}
              onDoubleClick={handleDoubleClickName}
            >
              {marker.name || 'Untitled Marker'}
            </p>
          )}
          <p className="text-[9px] text-[#d8d8d8]/35 font-mono mt-0.5">
            {formatTimecode(marker.time)}
          </p>
        </div>

        {/* Badges */}
        <div className="flex items-center gap-1 shrink-0">
          {attachmentCount > 0 && (
            <Badge variant="default">
              <Paperclip size={8} className="mr-0.5" />
              {attachmentCount}
            </Badge>
          )}
          {marker.ideaBoardData && (
            <Badge variant="accent">
              <Paintbrush size={8} />
            </Badge>
          )}
        </div>

        {/* Expand toggle */}
        <button
          onClick={handleToggleExpand}
          className="shrink-0 w-5 h-5 flex items-center justify-center rounded text-[#d8d8d8]/30 hover:text-[#d8d8d8]/60 hover:bg-white/[0.06] transition-all"
        >
          <ChevronDown
            size={13}
            className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          />
        </button>
      </div>

      {/* Expanded section */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3.5 pb-2.5 pt-0.5">
              {/* Notes */}
              <label className="block text-[9px] font-semibold text-[#d8d8d8]/50 uppercase tracking-wider mb-1">
                Notes
              </label>
              <textarea
                value={notesValue}
                onChange={handleNotesChange}
                placeholder="Add notes..."
                rows={3}
                className="w-full text-[10px] bg-[#1e1e1e] border border-white/[0.08] rounded-lg px-2 py-1.5 resize-none focus:border-[#5b9fd6] outline-none text-[#d8d8d8] placeholder:text-[#d8d8d8]/25"
                onClick={(e) => e.stopPropagation()}
              />

              {/* Attachments */}
              <AttachmentPanel
                markerId={marker.id}
                attachments={marker.attachments}
              />

              {/* Open Idea Board button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenIdeaBoard();
                }}
                className="mt-2 w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-[#5b9fd6]/10 text-[#5b9fd6] text-[10px] font-medium hover:bg-[#5b9fd6]/20 transition-colors"
              >
                <Paintbrush size={12} />
                Open Idea Board
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
