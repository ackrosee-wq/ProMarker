// ProMarker Project-Based File Storage
// Creates and manages <projectDir>/ProMarker/ folder structure.
// Falls back to localStorage when Node.js fs is unavailable (browser dev).

import type { ProMarker } from '../types';
import { debugLogger } from './debug-logger';

// Node.js modules - loaded dynamically in CEP via window.require.
// Typed as `any` to avoid requiring @types/node as a dev dependency.
let fs: any = null;
let path: any = null;

try {
  fs = (window as any).require?.('fs') ?? null;
  path = (window as any).require?.('path') ?? null;
} catch {
  // Not in CEP
}

const SUBDIRS = ['Images', 'Audio', 'Video', 'Doodles', 'Attachments', 'IdeaBoards'] as const;
const DATA_FILE = 'promarker-data.json';
const LOCAL_STORAGE_MARKERS_KEY = 'promarker_markers';
const LOCAL_STORAGE_IDEABOARD_PREFIX = 'promarker_ideaboard_';

class Storage {
  private promarkerDir = '';
  private useNodeFs = false;
  private initialized = false;

  /**
   * Initialise storage for the given project path.
   * Creates the ProMarker/ folder structure if it does not exist.
   */
  init(projectPath: string) {
    if (!projectPath) {
      debugLogger.warn('Storage.init', 'Empty project path provided');
      return;
    }

    if (fs && path) {
      this.useNodeFs = true;
      this.promarkerDir = path.join(projectPath, 'ProMarker');
      this.ensureDirectories();
    }

    this.initialized = true;
    debugLogger.info('Storage.init', `Initialized at ${this.promarkerDir || 'localStorage'}`);
  }

  /** Return the absolute path to the ProMarker data folder. */
  getProMarkerDir(): string {
    return this.promarkerDir;
  }

  // ---------------------------------------------------------------------------
  // Marker data persistence
  // ---------------------------------------------------------------------------

  /** Whether storage has been initialized. */
  get isInitialized() {
    return this.initialized;
  }

  /** Save the full marker array to promarker-data.json. */
  saveMarkers(markers: ProMarker[]) {
    const json = JSON.stringify(markers, null, 2);

    if (this.useNodeFs && fs && path && this.promarkerDir) {
      try {
        const filePath = path.join(this.promarkerDir, DATA_FILE);
        fs.writeFileSync(filePath, json, 'utf-8');
        debugLogger.info('Storage.saveMarkers', `Saved ${markers.length} markers`);
      } catch (e) {
        debugLogger.error('Storage.saveMarkers', `Write failed: ${e}`);
      }
      return;
    }

    // localStorage fallback
    try {
      localStorage.setItem(LOCAL_STORAGE_MARKERS_KEY, json);
      debugLogger.info('Storage.saveMarkers', `Saved ${markers.length} markers to localStorage`);
    } catch (e) {
      debugLogger.error('Storage.saveMarkers', `localStorage write failed: ${e}`);
    }
  }

  /** Load markers from promarker-data.json. Returns empty array on failure. */
  loadMarkers(): ProMarker[] {
    if (this.useNodeFs && fs && path) {
      try {
        const filePath = path.join(this.promarkerDir, DATA_FILE);
        if (!fs.existsSync(filePath)) return [];
        const raw = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(raw);
        if (Array.isArray(data)) {
          debugLogger.info('Storage.loadMarkers', `Loaded ${data.length} markers from disk`);
          return data as ProMarker[];
        }
      } catch (e) {
        debugLogger.error('Storage.loadMarkers', `Read failed: ${e}`);
      }
      return [];
    }

    // localStorage fallback
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_MARKERS_KEY);
      if (!raw) return [];
      const data = JSON.parse(raw);
      if (Array.isArray(data)) {
        debugLogger.info('Storage.loadMarkers', `Loaded ${data.length} markers from localStorage`);
        return data as ProMarker[];
      }
    } catch (e) {
      debugLogger.error('Storage.loadMarkers', `localStorage read failed: ${e}`);
    }
    return [];
  }

  // ---------------------------------------------------------------------------
  // Idea board persistence
  // ---------------------------------------------------------------------------

  /** Save idea board canvas JSON for a specific marker. */
  saveIdeaBoard(markerId: string, canvasJSON: string) {
    if (this.useNodeFs && fs && path) {
      try {
        const filePath = path.join(this.promarkerDir, 'IdeaBoards', `${markerId}.json`);
        fs.writeFileSync(filePath, canvasJSON, 'utf-8');
        debugLogger.info('Storage.saveIdeaBoard', `Saved board for marker ${markerId}`);
      } catch (e) {
        debugLogger.error('Storage.saveIdeaBoard', `Write failed: ${e}`);
      }
      return;
    }

    try {
      localStorage.setItem(LOCAL_STORAGE_IDEABOARD_PREFIX + markerId, canvasJSON);
    } catch (e) {
      debugLogger.error('Storage.saveIdeaBoard', `localStorage write failed: ${e}`);
    }
  }

  /** Load idea board canvas JSON for a specific marker. Returns null if not found. */
  loadIdeaBoard(markerId: string): string | null {
    if (this.useNodeFs && fs && path) {
      try {
        const filePath = path.join(this.promarkerDir, 'IdeaBoards', `${markerId}.json`);
        if (!fs.existsSync(filePath)) return null;
        return fs.readFileSync(filePath, 'utf-8');
      } catch (e) {
        debugLogger.error('Storage.loadIdeaBoard', `Read failed: ${e}`);
        return null;
      }
    }

    try {
      return localStorage.getItem(LOCAL_STORAGE_IDEABOARD_PREFIX + markerId) || null;
    } catch {
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Attachment file operations
  // ---------------------------------------------------------------------------

  /**
   * Save an attachment file into the appropriate subdirectory.
   * @param file  A File object (browser) or an absolute source path (string).
   * @param type  The attachment type, maps to a subdirectory.
   * @returns The absolute path where the file was saved, or '' on failure.
   */
  async saveAttachment(
    file: File | string,
    type: 'image' | 'video' | 'url' | 'file' | '3d-model'
  ): Promise<string> {
    const subdirMap: Record<string, string> = {
      image: 'Images',
      video: 'Video',
      url: 'Attachments',
      file: 'Attachments',
      '3d-model': 'Attachments',
    };
    const subdir = subdirMap[type] || 'Attachments';

    if (this.useNodeFs && fs && path) {
      try {
        const destDir = path.join(this.promarkerDir, subdir);

        if (typeof file === 'string') {
          // Copy file from source path
          const fileName = path.basename(file);
          const destPath = path.join(destDir, fileName);
          fs.copyFileSync(file, destPath);
          debugLogger.info('Storage.saveAttachment', `Copied ${fileName} to ${subdir}/`);
          return destPath;
        }

        // Handle File object - read as ArrayBuffer and write
        const fileName = file.name || `attachment_${Date.now()}`;
        const destPath = path.join(destDir, fileName);
        const arrayBuffer = await file.arrayBuffer();
        // Use Node.js Buffer via global (available in CEP with --enable-nodejs)
        const NodeBuffer = (globalThis as any).Buffer;
        const buffer = NodeBuffer ? NodeBuffer.from(arrayBuffer) : new Uint8Array(arrayBuffer);
        fs.writeFileSync(destPath, buffer);
        debugLogger.info('Storage.saveAttachment', `Saved ${fileName} to ${subdir}/`);
        return destPath;
      } catch (e) {
        debugLogger.error('Storage.saveAttachment', `Save failed: ${e}`);
        return '';
      }
    }

    // In browser/mock mode, return a fake path or data URL
    if (typeof file === 'string') {
      debugLogger.info('Storage.saveAttachment', `Mock save path: ${file}`);
      return file;
    }

    // Convert File to data URL for localStorage mock
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        try {
          localStorage.setItem(`promarker_attachment_${file.name}`, dataUrl);
        } catch {
          // quota exceeded - that is fine for mock mode
        }
        debugLogger.info('Storage.saveAttachment', `Mock saved ${file.name} as data URL`);
        resolve(dataUrl);
      };
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    });
  }

  // ---------------------------------------------------------------------------
  // Directory management
  // ---------------------------------------------------------------------------

  /** Create all required subdirectories under the ProMarker folder. */
  ensureDirectories() {
    if (!this.useNodeFs || !fs || !path) return;

    try {
      if (!fs.existsSync(this.promarkerDir)) {
        fs.mkdirSync(this.promarkerDir, { recursive: true } as any);
      }

      for (const sub of SUBDIRS) {
        const dir = path.join(this.promarkerDir, sub);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true } as any);
        }
      }

      debugLogger.info('Storage.ensureDirectories', `Verified folder structure at ${this.promarkerDir}`);
    } catch (e) {
      debugLogger.error('Storage.ensureDirectories', `Failed: ${e}`);
    }
  }
}

/** Singleton storage instance. */
export const storage = new Storage();
