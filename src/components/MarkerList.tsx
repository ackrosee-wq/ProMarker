import React, { useState, useRef, useCallback, useMemo } from 'react';
import { Search, Plus, ListX } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { MarkerItem } from './MarkerItem';
import { useMarkerStore } from '../store/marker-store';

type FilterOption = 'all' | 'checked' | 'unchecked';

const filterOptions: { value: FilterOption; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'unchecked', label: 'Unchecked' },
  { value: 'checked', label: 'Checked' },
];

export const MarkerList: React.FC = () => {
  const markers = useMarkerStore((s) => s.markers);
  const filter = useMarkerStore((s) => s.filter);
  const searchQuery = useMarkerStore((s) => s.searchQuery);
  const setFilter = useMarkerStore((s) => s.setFilter);
  const setSearchQuery = useMarkerStore((s) => s.setSearchQuery);
  const addMarker = useMarkerStore((s) => s.addMarker);
  const setSelectedMarker = useMarkerStore((s) => s.setSelectedMarker);

  // Lasso selection state
  const [isLasso, setIsLasso] = useState(false);
  const [lassoStart, setLassoStart] = useState<{ x: number; y: number } | null>(null);
  const [lassoEnd, setLassoEnd] = useState<{ x: number; y: number } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Filter and search markers
  const filteredMarkers = useMemo(() => {
    let result = markers;

    if (filter === 'checked') {
      result = result.filter((m) => m.checked);
    } else if (filter === 'unchecked') {
      result = result.filter((m) => !m.checked);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.notes.toLowerCase().includes(q)
      );
    }

    return result;
  }, [markers, filter, searchQuery]);

  const handleAddMarker = useCallback(() => {
    addMarker();
  }, [addMarker]);

  // Lasso selection handlers
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.shiftKey && listRef.current) {
        const rect = listRef.current.getBoundingClientRect();
        const pos = { x: e.clientX - rect.left, y: e.clientY - rect.top + listRef.current.scrollTop };
        setIsLasso(true);
        setLassoStart(pos);
        setLassoEnd(pos);
        e.preventDefault();
      }
    },
    []
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isLasso && listRef.current) {
        const rect = listRef.current.getBoundingClientRect();
        setLassoEnd({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top + listRef.current.scrollTop,
        });
      }
    },
    [isLasso]
  );

  const handleMouseUp = useCallback(() => {
    if (isLasso) {
      setIsLasso(false);
      setLassoStart(null);
      setLassoEnd(null);
      // Selection logic based on bounding rect intersections would go here
      // For now, lasso is a visual indicator; multi-select can be extended
    }
  }, [isLasso]);

  const lassoRect = useMemo(() => {
    if (!lassoStart || !lassoEnd) return null;
    return {
      left: Math.min(lassoStart.x, lassoEnd.x),
      top: Math.min(lassoStart.y, lassoEnd.y),
      width: Math.abs(lassoEnd.x - lassoStart.x),
      height: Math.abs(lassoEnd.y - lassoStart.y),
    };
  }, [lassoStart, lassoEnd]);

  return (
    <div className="flex flex-col h-full pb-14">
      {/* Search bar */}
      <div className="px-3 pt-2 pb-1.5">
        <div className="relative">
          <Search
            size={13}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#d8d8d8]/30 pointer-events-none"
          />
          <input
            type="text"
            placeholder="Search markers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#252525] border border-white/[0.06] rounded-lg pl-7 pr-3 py-1.5 text-[11px] text-[#d8d8d8] placeholder:text-[#d8d8d8]/30 focus:border-[#5b9fd6] outline-none transition-colors"
          />
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex items-center gap-1 px-3 pb-2">
        {filterOptions.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setFilter(opt.value)}
            className={`
              px-2.5 py-1 rounded-full text-[10px] font-medium transition-colors duration-150
              ${
                filter === opt.value
                  ? 'bg-[#5b9fd6]/20 text-[#5b9fd6]'
                  : 'bg-white/[0.05] text-[#d8d8d8]/50 hover:bg-white/[0.08] hover:text-[#d8d8d8]/70'
              }
            `}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Marker list */}
      <div
        ref={listRef}
        className="flex-1 overflow-y-auto px-3 relative no-select"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        {/* Lasso selection rect */}
        {isLasso && lassoRect && (
          <div
            className="absolute border border-[#5b9fd6]/50 bg-[#5b9fd6]/10 rounded pointer-events-none z-10"
            style={lassoRect}
          />
        )}

        {filteredMarkers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <ListX size={28} className="text-[#d8d8d8]/15 mb-2" />
            <p className="text-[11px] text-[#d8d8d8]/30">
              {markers.length === 0
                ? 'No markers yet'
                : 'No markers match your filter'}
            </p>
            {markers.length === 0 && (
              <p className="text-[10px] text-[#d8d8d8]/20 mt-1">
                Add markers in Premiere Pro or click the button below
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <AnimatePresence mode="popLayout">
              {filteredMarkers.map((marker) => (
                <MarkerItem key={marker.id} marker={marker} />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Add marker button */}
      <div className="px-3 py-2">
        <button
          onClick={handleAddMarker}
          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-[#5b9fd6]/10 text-[#5b9fd6] text-[11px] font-medium hover:bg-[#5b9fd6]/20 transition-colors active:bg-[#5b9fd6]/25"
        >
          <Plus size={14} />
          Add Marker
        </button>
      </div>
    </div>
  );
};
