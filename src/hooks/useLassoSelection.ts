// ProMarker Lasso Selection Hook
// Provides rectangular lasso selection for the marker list.
// Hold Shift + click-drag to draw a selection rectangle.
// All marker DOM elements that intersect the rectangle are selected.

import { useState, useCallback, useRef } from 'react';

interface SelectionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface LassoSelectionResult {
  /** Whether a lasso selection is actively being drawn. */
  isSelecting: boolean;
  /** The current selection rectangle in viewport coordinates. */
  selectionRect: SelectionRect | null;
  /** Set of marker IDs whose DOM elements intersect the lasso rectangle. */
  selectedIds: Set<string>;
  /** Attach to the container's onMouseDown. */
  onMouseDown: (e: React.MouseEvent) => void;
  /** Attach to the container's onMouseMove (or window). */
  onMouseMove: (e: React.MouseEvent) => void;
  /** Attach to the container's onMouseUp (or window). */
  onMouseUp: (e: React.MouseEvent) => void;
  /** Clear the current selection. */
  clearSelection: () => void;
}

/**
 * Hook for lasso (rectangular) selection of marker list items.
 *
 * @param containerRef  Ref to the scrollable container element.
 * @param markerSelector  CSS selector that identifies individual marker elements.
 *                         Each element must have a `data-marker-id` attribute.
 */
export function useLassoSelection(
  containerRef: React.RefObject<HTMLElement | null>,
  markerSelector = '[data-marker-id]'
): LassoSelectionResult {
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionRect, setSelectionRect] = useState<SelectionRect | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const startPoint = useRef<{ x: number; y: number } | null>(null);

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  /** Normalise a rect so width/height are always positive. */
  const normaliseRect = (
    x1: number,
    y1: number,
    x2: number,
    y2: number
  ): SelectionRect => ({
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    width: Math.abs(x2 - x1),
    height: Math.abs(y2 - y1),
  });

  /** Check if two rectangles intersect. */
  const rectsIntersect = (a: SelectionRect, b: DOMRect): boolean =>
    a.x < b.right &&
    a.x + a.width > b.left &&
    a.y < b.bottom &&
    a.y + a.height > b.top;

  /** Find all marker elements intersecting the given rect and return their IDs. */
  const findIntersectingMarkers = useCallback(
    (rect: SelectionRect): Set<string> => {
      const container = containerRef.current;
      if (!container) return new Set();

      const elements = container.querySelectorAll(markerSelector);
      const ids = new Set<string>();

      elements.forEach((el) => {
        const domRect = el.getBoundingClientRect();
        if (rectsIntersect(rect, domRect)) {
          const id = el.getAttribute('data-marker-id');
          if (id) ids.add(id);
        }
      });

      return ids;
    },
    [containerRef, markerSelector]
  );

  // -------------------------------------------------------------------------
  // Event handlers
  // -------------------------------------------------------------------------

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Only activate with shift held and left mouse button
      if (!e.shiftKey || e.button !== 0) return;

      e.preventDefault();
      startPoint.current = { x: e.clientX, y: e.clientY };
      setIsSelecting(true);
      setSelectionRect(null);
      setSelectedIds(new Set());
    },
    []
  );

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isSelecting || !startPoint.current) return;

      const rect = normaliseRect(
        startPoint.current.x,
        startPoint.current.y,
        e.clientX,
        e.clientY
      );

      setSelectionRect(rect);

      // Continuously update selected IDs as the rect changes
      const ids = findIntersectingMarkers(rect);
      setSelectedIds(ids);
    },
    [isSelecting, findIntersectingMarkers]
  );

  const onMouseUp = useCallback(
    (_e: React.MouseEvent) => {
      if (!isSelecting) return;

      setIsSelecting(false);
      startPoint.current = null;
      // Keep selectionRect and selectedIds so the caller can read final state.
      // The caller should call clearSelection() when done.
      setSelectionRect(null);
    },
    [isSelecting]
  );

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setSelectionRect(null);
    setIsSelecting(false);
    startPoint.current = null;
  }, []);

  return {
    isSelecting,
    selectionRect,
    selectedIds,
    onMouseDown,
    onMouseMove,
    onMouseUp,
    clearSelection,
  };
}
