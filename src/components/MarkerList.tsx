import React, { useState, useCallback, useMemo } from 'react';
import { Search, Plus, ListX } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { MarkerItem } from './MarkerItem';
import { useMarkerStore } from '../store/marker-store';

type FilterOption = 'all' | 'checked' | 'unchecked';

const filterOptions: { value: FilterOption; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'unchecked', label: 'To Do' },
  { value: 'checked', label: 'Done' },
];

interface MarkerListProps {
  onOpenIdeaBoard: (markerId: string) => void;
}

export const MarkerList: React.FC<MarkerListProps> = ({ onOpenIdeaBoard }) => {
  const markers = useMarkerStore((s) => s.markers);
  const filter = useMarkerStore((s) => s.filter);
  const searchQuery = useMarkerStore((s) => s.searchQuery);
  const setFilter = useMarkerStore((s) => s.setFilter);
  const setSearchQuery = useMarkerStore((s) => s.setSearchQuery);
  const addMarker = useMarkerStore((s) => s.addMarker);

  const filteredMarkers = useMemo(() => {
    let result = markers;
    if (filter === 'checked') result = result.filter((m) => m.checked);
    else if (filter === 'unchecked') result = result.filter((m) => !m.checked);

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (m) => m.name.toLowerCase().includes(q) || m.notes.toLowerCase().includes(q)
      );
    }
    return result;
  }, [markers, filter, searchQuery]);

  const handleAddMarker = useCallback(() => {
    addMarker();
  }, [addMarker]);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Search + Filter */}
      <div className="px-2 pt-2 pb-1 shrink-0">
        <div className="relative mb-1.5">
          <Search
            size={12}
            className="absolute left-2 top-1/2 -translate-y-1/2 text-[#888] pointer-events-none"
          />
          <input
            type="text"
            placeholder="Search markers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-7 bg-[#1e1e1e] border border-[#3a3a3a] rounded-md pl-6 pr-2 text-[11px] text-[#e0e0e0] placeholder:text-[#555] focus:border-[#4a9eff] outline-none transition-[border-color] duration-[120ms]"
          />
        </div>
        <div className="flex items-center gap-1">
          {filterOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              className={`
                h-6 px-2.5 rounded-md text-[10px] font-medium transition-[color,background,border-color] duration-[120ms]
                ${filter === opt.value
                  ? 'bg-[#4a9eff22] text-[#4a9eff] border border-[#4a9eff44]'
                  : 'bg-[#2a2a2a] text-[#888] border border-transparent hover:text-[#e0e0e0]'
                }
              `}
            >
              {opt.label}
            </button>
          ))}
          <span className="ml-auto text-[9px] text-[#555]">
            {filteredMarkers.length}/{markers.length}
          </span>
        </div>
      </div>

      {/* Marker list */}
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {filteredMarkers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <ListX size={24} className="text-[#333] mb-2" />
            <p className="text-[10px] text-[#555]">
              {markers.length === 0
                ? 'No markers yet'
                : 'No markers match'}
            </p>
            {markers.length === 0 && (
              <p className="text-[9px] text-[#444] mt-0.5">
                Add markers in Premiere or click + below
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-[3px] pt-1">
            <AnimatePresence mode="popLayout">
              {filteredMarkers.map((marker) => (
                <MarkerItem
                  key={marker.id}
                  marker={marker}
                  onOpenIdeaBoard={() => onOpenIdeaBoard(marker.id)}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Add marker button — bottom */}
      <div className="px-2 py-1.5 shrink-0 border-t border-[#3a3a3a]">
        <button
          onClick={handleAddMarker}
          className="w-full h-7 flex items-center justify-center gap-1 rounded-md bg-[#4a9eff22] text-[#4a9eff] text-[10px] font-medium border border-[#4a9eff44] hover:bg-[#4a9eff33] active:scale-[0.97] transition-[background,transform] duration-100"
        >
          <Plus size={13} />
          Add Marker
        </button>
      </div>
    </div>
  );
};
