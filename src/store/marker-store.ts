// ProMarker Marker Store
// Zustand store managing the full lifecycle of markers: CRUD, sync with Premiere,
// persistence to disk, filtering, searching, and reordering.

import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { ProMarker } from '../types';
import { cepBridge } from '../bridge/cep-bridge';
import { storage } from '../lib/storage';
import { debugLogger } from '../lib/debug-logger';

interface MarkerState {
  markers: ProMarker[];
  selectedMarkerId: string | null;
  filter: 'all' | 'checked' | 'unchecked';
  searchQuery: string;

  // Actions
  addMarker: (name?: string) => Promise<void>;
  removeMarker: (id: string) => Promise<void>;
  updateMarker: (id: string, updates: Partial<ProMarker>) => Promise<void>;
  toggleChecked: (id: string) => Promise<void>;
  setSelectedMarker: (id: string | null) => void;
  setFilter: (filter: 'all' | 'checked' | 'unchecked') => void;
  setSearchQuery: (query: string) => void;
  reorderMarkers: (fromIndex: number, toIndex: number) => void;
  syncFromPremiere: () => Promise<void>;
  forceReload: () => Promise<void>;
  loadFromStorage: () => Promise<void>;
  saveToStorage: () => Promise<void>;

  // Computed
  filteredMarkers: () => ProMarker[];
}

export const useMarkerStore = create<MarkerState>((set, get) => ({
  markers: [],
  selectedMarkerId: null,
  filter: 'all',
  searchQuery: '',

  // ---------------------------------------------------------------------------
  // Add a new marker
  // ---------------------------------------------------------------------------
  addMarker: async (name?: string) => {
    try {
      const currentTime = await cepBridge.getCurrentTime();
      const markerName = name || `Marker ${get().markers.length + 1}`;

      // Create the marker in Premiere first
      const guid = await cepBridge.addMarkerToTimeline({
        name: markerName,
        time: currentTime,
        duration: 0,
        color: 'green',
      });

      const newMarker: ProMarker = {
        id: guid || uuidv4(),
        name: markerName,
        time: currentTime,
        duration: 0,
        color: 'green',
        checked: false,
        notes: '',
        attachments: [],
        ideaBoardData: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      set((state) => ({
        markers: [...state.markers, newMarker],
        selectedMarkerId: newMarker.id,
      }));

      await get().saveToStorage();
      debugLogger.info('addMarker', `Created "${markerName}" at ${currentTime}s (id=${newMarker.id})`);
    } catch (e) {
      debugLogger.error('addMarker', `Failed: ${e}`);
    }
  },

  // ---------------------------------------------------------------------------
  // Remove a marker
  // ---------------------------------------------------------------------------
  removeMarker: async (id: string) => {
    try {
      const marker = get().markers.find((m) => m.id === id);
      if (!marker) return;

      // Remove from Premiere timeline if it exists there
      if (!marker.checked) {
        await cepBridge.removeMarkerFromTimeline(id);
      }

      set((state) => ({
        markers: state.markers.filter((m) => m.id !== id),
        selectedMarkerId: state.selectedMarkerId === id ? null : state.selectedMarkerId,
      }));

      await get().saveToStorage();
      debugLogger.info('removeMarker', `Removed "${marker.name}" (id=${id})`);
    } catch (e) {
      debugLogger.error('removeMarker', `Failed for id=${id}: ${e}`);
    }
  },

  // ---------------------------------------------------------------------------
  // Update marker fields
  // ---------------------------------------------------------------------------
  updateMarker: async (id: string, updates: Partial<ProMarker>) => {
    try {
      const marker = get().markers.find((m) => m.id === id);
      if (!marker) return;

      // If the name changed, update it in Premiere too
      if (updates.name && updates.name !== marker.name) {
        await cepBridge.updateMarkerName(id, updates.name);
      }

      // If notes changed, store them in the marker's comments field
      if (updates.notes !== undefined && updates.notes !== marker.notes) {
        await cepBridge.updateMarkerComments(id, updates.notes);
      }

      set((state) => ({
        markers: state.markers.map((m) =>
          m.id === id ? { ...m, ...updates, updatedAt: Date.now() } : m
        ),
      }));

      await get().saveToStorage();
      debugLogger.info('updateMarker', `Updated "${marker.name}" (id=${id}): ${Object.keys(updates).join(', ')}`);
    } catch (e) {
      debugLogger.error('updateMarker', `Failed for id=${id}: ${e}`);
    }
  },

  // ---------------------------------------------------------------------------
  // Toggle checked state (done/undone)
  // ---------------------------------------------------------------------------
  toggleChecked: async (id: string) => {
    try {
      const marker = get().markers.find((m) => m.id === id);
      if (!marker) return;

      const newChecked = !marker.checked;

      if (newChecked) {
        // Marking as done: remove from Premiere timeline
        await cepBridge.removeMarkerFromTimeline(id);
        debugLogger.info('toggleChecked', `Checked (done) "${marker.name}" - removed from timeline`);
      } else {
        // Unchecking: restore the marker to the timeline
        const guid = await cepBridge.addMarkerToTimeline({
          name: marker.name,
          time: marker.time,
          duration: marker.duration,
          color: marker.color,
        });
        // Update the id if Premiere assigned a new GUID
        if (guid && guid !== id) {
          set((state) => ({
            markers: state.markers.map((m) =>
              m.id === id
                ? { ...m, id: guid, checked: false, updatedAt: Date.now() }
                : m
            ),
            selectedMarkerId: state.selectedMarkerId === id ? guid : state.selectedMarkerId,
          }));
          await get().saveToStorage();
          debugLogger.info('toggleChecked', `Unchecked "${marker.name}" - restored to timeline with new guid=${guid}`);
          return;
        }
        debugLogger.info('toggleChecked', `Unchecked "${marker.name}" - restored to timeline`);
      }

      set((state) => ({
        markers: state.markers.map((m) =>
          m.id === id ? { ...m, checked: newChecked, updatedAt: Date.now() } : m
        ),
      }));

      await get().saveToStorage();
    } catch (e) {
      debugLogger.error('toggleChecked', `Failed for id=${id}: ${e}`);
    }
  },

  // ---------------------------------------------------------------------------
  // Selection
  // ---------------------------------------------------------------------------
  setSelectedMarker: (id) => set({ selectedMarkerId: id }),

  // ---------------------------------------------------------------------------
  // Filtering & search
  // ---------------------------------------------------------------------------
  setFilter: (filter) => set({ filter }),

  setSearchQuery: (query) => set({ searchQuery: query }),

  // ---------------------------------------------------------------------------
  // Reorder markers (drag & drop)
  // ---------------------------------------------------------------------------
  reorderMarkers: (fromIndex: number, toIndex: number) => {
    set((state) => {
      const markers = [...state.markers];
      if (
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= markers.length ||
        toIndex >= markers.length
      ) {
        return state;
      }
      const [moved] = markers.splice(fromIndex, 1);
      markers.splice(toIndex, 0, moved);
      return { markers };
    });

    // Save async - fire and forget
    get().saveToStorage().catch(() => {});
    debugLogger.info('reorderMarkers', `Moved marker from index ${fromIndex} to ${toIndex}`);
  },

  // ---------------------------------------------------------------------------
  // Sync from Premiere Pro
  // ---------------------------------------------------------------------------
  syncFromPremiere: async () => {
    try {
      const pproMarkers = await cepBridge.getSequenceMarkers();
      if (!pproMarkers) return;
      // Don't skip on empty — we still need to preserve checked markers

      set((state) => {
        const existingById = new Map(state.markers.map((m) => [m.id, m]));
        const updatedMarkers: ProMarker[] = [];
        const pproGuids = new Set(pproMarkers.map((pm) => pm.guid));

        // Process markers from Premiere
        for (const pm of pproMarkers) {
          const existing = existingById.get(pm.guid);
          if (existing) {
            // Merge: keep local enrichments (attachments, checked, ideaBoardData)
            // but update time/duration/color from Premiere (source of truth for timeline data)
            // Notes come from marker comments in Premiere
            updatedMarkers.push({
              ...existing,
              name: pm.name || existing.name,
              time: pm.time,
              duration: pm.duration,
              color: pm.color || existing.color,
              notes: pm.comments || existing.notes,
              updatedAt: Date.now(),
            });
          } else {
            // New marker from Premiere - create local entry
            updatedMarkers.push({
              id: pm.guid,
              name: pm.name || 'Untitled',
              time: pm.time,
              duration: pm.duration,
              color: pm.color || 'green',
              checked: false,
              notes: pm.comments || '',
              attachments: [],
              ideaBoardData: null,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            });
          }
        }

        // Keep checked markers that are no longer on the timeline
        // (they were removed when checked, so Premiere won't have them)
        for (const existing of state.markers) {
          if (existing.checked && !pproGuids.has(existing.id)) {
            updatedMarkers.push(existing);
          }
        }

        // Sort by time
        updatedMarkers.sort((a, b) => a.time - b.time);

        return { markers: updatedMarkers };
      });

      await get().saveToStorage();
      debugLogger.info('syncFromPremiere', `Synced ${pproMarkers.length} markers from timeline`);
    } catch (e) {
      debugLogger.error('syncFromPremiere', `Failed: ${e}`);
    }
  },

  // ---------------------------------------------------------------------------
  // Force reload: clear state and re-fetch everything
  // ---------------------------------------------------------------------------
  forceReload: async () => {
    try {
      debugLogger.info('forceReload', 'Starting full reload');

      // Load from storage first (has all local enrichments)
      const storedMarkers = storage.loadMarkers();

      // Fetch current state from Premiere
      const pproMarkers = await cepBridge.getSequenceMarkers();

      const storedById = new Map(storedMarkers.map((m) => [m.id, m]));
      const merged: ProMarker[] = [];
      const pproGuids = new Set(pproMarkers.map((pm) => pm.guid));

      // Merge Premiere markers with stored data
      for (const pm of pproMarkers) {
        const stored = storedById.get(pm.guid);
        if (stored) {
          merged.push({
            ...stored,
            name: pm.name || stored.name,
            time: pm.time,
            duration: pm.duration,
            color: pm.color || stored.color,
            updatedAt: Date.now(),
          });
        } else {
          merged.push({
            id: pm.guid,
            name: pm.name || 'Untitled',
            time: pm.time,
            duration: pm.duration,
            color: pm.color || 'green',
            checked: false,
            notes: '',
            attachments: [],
            ideaBoardData: null,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });
        }
      }

      // Keep checked markers from storage
      for (const stored of storedMarkers) {
        if (stored.checked && !pproGuids.has(stored.id)) {
          merged.push(stored);
        }
      }

      merged.sort((a, b) => a.time - b.time);

      set({
        markers: merged,
        selectedMarkerId: null,
      });

      await get().saveToStorage();
      debugLogger.info('forceReload', `Reload complete: ${merged.length} markers`);
    } catch (e) {
      debugLogger.error('forceReload', `Failed: ${e}`);
    }
  },

  // ---------------------------------------------------------------------------
  // Persistence
  // ---------------------------------------------------------------------------
  loadFromStorage: async () => {
    try {
      const markers = storage.loadMarkers();
      if (markers.length > 0) {
        set({ markers });
        debugLogger.info('loadFromStorage', `Loaded ${markers.length} markers`);
      }
    } catch (e) {
      debugLogger.error('loadFromStorage', `Failed: ${e}`);
    }
  },

  saveToStorage: async () => {
    try {
      storage.saveMarkers(get().markers);
    } catch (e) {
      debugLogger.error('saveToStorage', `Failed: ${e}`);
    }
  },

  // ---------------------------------------------------------------------------
  // Computed: filtered markers
  // ---------------------------------------------------------------------------
  filteredMarkers: () => {
    const { markers, filter, searchQuery } = get();
    let result = markers;

    // Apply checked/unchecked filter
    if (filter === 'checked') {
      result = result.filter((m) => m.checked);
    } else if (filter === 'unchecked') {
      result = result.filter((m) => !m.checked);
    }

    // Apply search query (case-insensitive name match)
    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      result = result.filter(
        (m) =>
          m.name.toLowerCase().includes(query) ||
          m.notes.toLowerCase().includes(query)
      );
    }

    return result;
  },
}));
