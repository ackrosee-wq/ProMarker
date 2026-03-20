// ProMarker CEP Bridge
// Handles communication between the React panel and Premiere Pro via ExtendScript.
// Falls back to a mock bridge with sample data when not running inside CEP.

import type { PProMarkerData, BridgeEventName, BridgeEvents } from './types';
import { debugLogger } from '../lib/debug-logger';

type EventCallback = (data: any) => void;

// ---------------------------------------------------------------------------
// Mock data for development outside Premiere Pro
// ---------------------------------------------------------------------------

const MOCK_MARKERS: PProMarkerData[] = [
  { name: 'Intro Title', time: 0.0, duration: 2.5, color: 'green', guid: 'mock-guid-001' },
  { name: 'Interview A - Start', time: 5.2, duration: 0, color: 'blue', guid: 'mock-guid-002' },
  { name: 'B-Roll Mountains', time: 12.8, duration: 4.0, color: 'cyan', guid: 'mock-guid-003' },
  { name: 'Music Cue - Strings', time: 22.0, duration: 0, color: 'purple', guid: 'mock-guid-004' },
  { name: 'Lower Third - John', time: 30.5, duration: 3.0, color: 'yellow', guid: 'mock-guid-005' },
  { name: 'VFX Shot - Replace Sky', time: 45.0, duration: 6.0, color: 'red', guid: 'mock-guid-006' },
  { name: 'Transition - Crossfade', time: 58.3, duration: 1.5, color: 'orange', guid: 'mock-guid-007' },
  { name: 'Credits Start', time: 72.0, duration: 8.0, color: 'white', guid: 'mock-guid-008' },
];

let mockGuidCounter = 100;

// ---------------------------------------------------------------------------
// CepBridge class
// ---------------------------------------------------------------------------

class CepBridge {
  private csInterface: any = null;
  private jsxReady = false;
  private eventHandlers = new Map<string, EventCallback[]>();
  private retryCount = 0;
  private maxRetries = 30;
  private retryDelay = 500;
  private isMock = false;
  private mockMarkers: PProMarkerData[] = [...MOCK_MARKERS];
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  /**
   * Initialise the bridge.
   * @returns true if running inside CEP, false if mock mode.
   */
  init(): boolean {
    try {
      const CSI = (window as any).CSInterface;
      if (CSI) {
        this.csInterface = new CSI();
      }
    } catch {
      // Not in CEP environment
    }

    if (!this.csInterface) {
      this.isMock = true;
      this.jsxReady = true;
      console.log('[ProMarker] Not in CEP environment, using mock mode');
      debugLogger.info('CepBridge.init', 'Mock mode activated');
      // Emit connected after a tick so listeners can register first
      setTimeout(() => this.emit('connected', null), 100);
      return false;
    }

    this.isMock = false;
    debugLogger.info('CepBridge.init', 'CEP environment detected, loading JSX');
    this.loadJSXAndConnect();
    this.registerCepEvents();
    return true;
  }

  /** Clean up timers and listeners. */
  dispose() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.eventHandlers.clear();
  }

  /** Whether we are running in mock/dev mode. */
  get isMockMode(): boolean {
    return this.isMock;
  }

  /** Whether the JSX layer is ready. */
  get isReady(): boolean {
    return this.jsxReady;
  }

  // -------------------------------------------------------------------------
  // Event emitter
  // -------------------------------------------------------------------------

  on<K extends BridgeEventName>(event: K, handler: (data: BridgeEvents[K]) => void): void;
  on(event: string, handler: EventCallback): void {
    const handlers = this.eventHandlers.get(event) || [];
    handlers.push(handler);
    this.eventHandlers.set(event, handlers);
  }

  off<K extends BridgeEventName>(event: K, handler: (data: BridgeEvents[K]) => void): void;
  off(event: string, handler: EventCallback): void {
    const handlers = this.eventHandlers.get(event);
    if (!handlers) return;
    const idx = handlers.indexOf(handler);
    if (idx >= 0) handlers.splice(idx, 1);
  }

  emit<K extends BridgeEventName>(event: K, data: BridgeEvents[K]): void;
  emit(event: string, data: any): void {
    const handlers = this.eventHandlers.get(event);
    if (!handlers) return;
    for (const handler of handlers) {
      try {
        handler(data);
      } catch (e) {
        debugLogger.error('CepBridge.emit', `Handler error for "${event}": ${e}`);
      }
    }
  }

  // -------------------------------------------------------------------------
  // JSX loading & connection
  // -------------------------------------------------------------------------

  private loadJSXAndConnect() {
    if (!this.csInterface) return;

    const extensionPath = this.csInterface.getSystemPath('extension');
    const jsxPath = extensionPath + '/jsx/ppro-markers.jsx';

    debugLogger.info('CepBridge.loadJSX', `Loading ${jsxPath}`);

    this.csInterface.evalScript(`$.evalFile("${jsxPath.replace(/\\/g, '/')}")`, (result: string) => {
      if (result === 'EvalScript_ErrMessage' || result === '') {
        // JSX file might not have loaded; retry
        this.retryConnection();
        return;
      }
      this.verifyConnection();
    });
  }

  private retryConnection() {
    this.retryCount++;
    if (this.retryCount > this.maxRetries) {
      debugLogger.error('CepBridge.retry', `Failed to connect after ${this.maxRetries} attempts`);
      this.emit('disconnected', null);
      return;
    }

    debugLogger.warn('CepBridge.retry', `Attempt ${this.retryCount}/${this.maxRetries}`);
    setTimeout(() => this.loadJSXAndConnect(), this.retryDelay);
  }

  private verifyConnection() {
    this.evalScript('getProjectPath()').then((result) => {
      if (result !== '' && result !== 'EvalScript_ErrMessage' && result !== 'undefined') {
        this.jsxReady = true;
        this.retryCount = 0;
        debugLogger.info('CepBridge.verify', `Connected. Project path: ${result}`);
        this.emit('connected', null);
        this.startPolling();
      } else {
        // Project may not be open yet; retry
        this.retryConnection();
      }
    });
  }

  /** Register CEP-level events (sequence activated, project changed, etc.). */
  private registerCepEvents() {
    if (!this.csInterface) return;

    // Listen for sequence activation changes
    this.csInterface.addEventListener(
      'com.adobe.csxs.events.SequenceActivated',
      () => {
        debugLogger.info('CepBridge.event', 'Sequence activated');
        this.getActiveSequenceName().then((name) => {
          this.emit('sequenceChanged', name);
        });
      }
    );
  }

  /** Poll Premiere for marker changes periodically. */
  private startPolling() {
    if (this.pollTimer) return;
    // Poll every 3 seconds for marker changes
    this.pollTimer = setInterval(async () => {
      try {
        const markers = await this.getSequenceMarkers();
        this.emit('markersChanged', markers);
      } catch {
        // ignore polling errors
      }
    }, 3000);
  }

  // -------------------------------------------------------------------------
  // Script evaluation
  // -------------------------------------------------------------------------

  private evalScript(script: string): Promise<string> {
    return new Promise((resolve) => {
      if (!this.csInterface || !this.jsxReady) {
        resolve('');
        return;
      }
      this.csInterface.evalScript(script, (result: string) => {
        resolve(result || '');
      });
    });
  }

  // -------------------------------------------------------------------------
  // Premiere Pro marker operations
  // -------------------------------------------------------------------------

  /** Get the project directory path (without the .prproj filename). */
  async getProjectPath(): Promise<string> {
    if (this.isMock) {
      return '/mock/project/path';
    }
    const result = await this.evalScript('getProjectPath()');
    return result || '';
  }

  /** Fetch all markers from the active sequence. */
  async getSequenceMarkers(): Promise<PProMarkerData[]> {
    if (this.isMock) {
      return [...this.mockMarkers];
    }

    const result = await this.evalScript('getSequenceMarkers()');
    if (!result || result === 'EvalScript_ErrMessage') return [];

    try {
      const parsed = JSON.parse(result);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      debugLogger.error('CepBridge.getSequenceMarkers', `Parse error: ${result}`);
      return [];
    }
  }

  /**
   * Add a marker to the active sequence timeline.
   * @returns The GUID of the new marker, or '' on failure.
   */
  async addMarkerToTimeline(marker: {
    name: string;
    time: number;
    duration?: number;
    color?: string;
  }): Promise<string> {
    if (this.isMock) {
      const guid = `mock-guid-${++mockGuidCounter}`;
      const colorStr = marker.color || 'green';
      this.mockMarkers.push({
        name: marker.name,
        time: marker.time,
        duration: marker.duration || 0,
        color: colorStr,
        guid,
      });
      debugLogger.info('CepBridge.addMarker', `Mock marker added: ${marker.name} (${guid})`);
      return guid;
    }

    const colorIndex = this.colorNameToIndex(marker.color || 'green');
    const script = `addMarkerAtTime("${this.escapeJsx(marker.name)}", ${marker.time}, ${marker.duration || 0}, ${colorIndex})`;
    const result = await this.evalScript(script);
    debugLogger.info('CepBridge.addMarker', `Added marker "${marker.name}" => ${result}`);
    return result || '';
  }

  /** Remove a marker from the timeline by GUID. */
  async removeMarkerFromTimeline(guid: string): Promise<boolean> {
    if (this.isMock) {
      const idx = this.mockMarkers.findIndex((m) => m.guid === guid);
      if (idx >= 0) {
        this.mockMarkers.splice(idx, 1);
        debugLogger.info('CepBridge.removeMarker', `Mock marker removed: ${guid}`);
        return true;
      }
      return false;
    }

    const result = await this.evalScript(`removeMarkerByGuid("${this.escapeJsx(guid)}")`);
    const success = result === 'true';
    debugLogger.info('CepBridge.removeMarker', `Remove ${guid}: ${success}`);
    return success;
  }

  /** Update the name of an existing marker. */
  async updateMarkerName(guid: string, name: string): Promise<boolean> {
    if (this.isMock) {
      const marker = this.mockMarkers.find((m) => m.guid === guid);
      if (marker) {
        marker.name = name;
        debugLogger.info('CepBridge.updateMarkerName', `Mock marker renamed: ${guid} => ${name}`);
        return true;
      }
      return false;
    }

    const result = await this.evalScript(
      `updateMarkerName("${this.escapeJsx(guid)}", "${this.escapeJsx(name)}")`
    );
    const success = result === 'true';
    debugLogger.info('CepBridge.updateMarkerName', `Rename ${guid} to "${name}": ${success}`);
    return success;
  }

  /** Get the current playhead time in seconds. */
  async getCurrentTime(): Promise<number> {
    if (this.isMock) {
      return 15.5; // Mock playhead position
    }

    const result = await this.evalScript('getCurrentTime()');
    return parseFloat(result) || 0;
  }

  /** Get the name of the active sequence. */
  async getActiveSequenceName(): Promise<string> {
    if (this.isMock) {
      return 'Mock Sequence v1';
    }

    const result = await this.evalScript('getActiveSequenceName()');
    return result || '';
  }

  /** Get project info (path, name, promarker directory). */
  async getProjectInfo(): Promise<{ projectPath: string; projectName: string; promarkerDir: string } | null> {
    if (this.isMock) {
      return {
        projectPath: '/mock/project/path',
        projectName: 'Mock Project',
        promarkerDir: '/mock/project/path/ProMarker',
      };
    }

    const result = await this.evalScript('getProjectInfo()');
    if (!result || result === 'EvalScript_ErrMessage') return null;

    try {
      const parsed = JSON.parse(result);
      return {
        projectPath: parsed.projectPath || '',
        projectName: parsed.projectName || '',
        promarkerDir: (parsed.projectPath || '') + 'ProMarker/',
      };
    } catch {
      debugLogger.error('CepBridge.getProjectInfo', `Parse error: ${result}`);
      return null;
    }
  }

  /**
   * Push idea board canvas data to AE/Premiere as marker comments or metadata.
   * This is a convenience method for cross-app workflows.
   */
  async pushIdeaBoardToAE(markerId: string, canvasJSON: string): Promise<boolean> {
    if (this.isMock) {
      debugLogger.info('CepBridge.pushIdeaBoardToAE', `Mock push for marker ${markerId}`);
      return true;
    }

    // Store the canvas JSON as a marker comment in Premiere
    // This is a simplified approach - real implementation would use XMP or sidecar files
    const escaped = this.escapeJsx(canvasJSON.substring(0, 10000)); // Limit size for ExtendScript
    const result = await this.evalScript(
      `updateMarkerName("${this.escapeJsx(markerId)}", "${escaped}")`
    );
    return result === 'true';
  }

  // -------------------------------------------------------------------------
  // File system helpers
  // -------------------------------------------------------------------------

  /** Get the absolute path to the extension root directory. */
  getExtensionPath(): string {
    if (this.isMock) {
      return '/mock/extension/path';
    }
    if (!this.csInterface) return '';
    return this.csInterface.getSystemPath('extension') || '';
  }

  /** Get a CEP system path by type (e.g. 'extension', 'userData', 'commonFiles'). */
  getSystemPath(type: string): string {
    if (this.isMock) {
      return `/mock/system/${type}`;
    }
    if (!this.csInterface) return '';
    return this.csInterface.getSystemPath(type) || '';
  }

  /** Open a URL in the system default browser. */
  openURL(url: string): void {
    if (this.isMock) {
      debugLogger.info('CepBridge.openURL', `Mock open URL: ${url}`);
      window.open(url, '_blank');
      return;
    }
    if (this.csInterface) {
      this.csInterface.openURLInDefaultBrowser(url);
    }
  }

  /** Open a folder in the system file manager. */
  openFolder(path: string): void {
    if (this.isMock) {
      debugLogger.info('CepBridge.openFolder', `Mock open folder: ${path}`);
      return;
    }
    // Use ExtendScript to open the folder via Folder object
    this.evalScript(`var f = new Folder("${this.escapeJsx(path)}"); f.execute();`);
  }

  // -------------------------------------------------------------------------
  // Utilities
  // -------------------------------------------------------------------------

  /** Escape a string for safe embedding in an ExtendScript expression. */
  private escapeJsx(str: string): string {
    return str
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t');
  }

  /** Map a color name to Premiere Pro's marker color index. */
  private colorNameToIndex(color: string): number {
    const map: Record<string, number> = {
      green: 0,
      red: 1,
      purple: 2,
      orange: 3,
      yellow: 4,
      white: 5,
      blue: 6,
      cyan: 7,
    };
    return map[color.toLowerCase()] ?? 0;
  }
}

/** Singleton CEP bridge instance. */
export const cepBridge = new CepBridge();
