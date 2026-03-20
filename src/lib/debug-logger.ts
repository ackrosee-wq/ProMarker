// ProMarker Debug Logger
// Writes structured logs to .debug-logs/ folder within the extension directory.
// Falls back to localStorage when Node.js fs is unavailable (browser dev).

// Node.js modules - loaded dynamically in CEP via window.require.
// Typed as `any` to avoid requiring @types/node as a dev dependency.
let fs: any = null;
let path: any = null;

try {
  // In CEP with --enable-nodejs, require is available globally
  fs = (window as any).require?.('fs') ?? null;
  path = (window as any).require?.('path') ?? null;
} catch {
  // Not in CEP or Node not available
}

type LogLevel = 'info' | 'warn' | 'error';

const LOCAL_STORAGE_KEY = 'promarker_debug_logs';

class DebugLogger {
  private version = '1.0.1';
  private extensionPath = '';
  private logDir = '';
  private logFilePath = '';
  private initialized = false;
  private useNodeFs = false;
  private buffer: string[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Initialise the logger. Call once at app startup.
   * extensionPath is the root of the CEP extension on disk.
   */
  init(extensionPath?: string) {
    if (this.initialized) return;

    // Read version from bundled version.json (injected via import at build time
    // or fetched at runtime).  Fallback kept so the logger always works.
    this.version = this.readVersion();

    if (fs && path && extensionPath) {
      this.useNodeFs = true;
      this.extensionPath = extensionPath;
      this.logDir = path.join(extensionPath, '.debug-logs');
      this.logFilePath = path.join(
        this.logDir,
        `promarker_v${this.version}.log`
      );
      this.ensureLogDir();
    }

    this.initialized = true;
    this.info('DebugLogger', `Initialized v${this.version} | nodeFs=${this.useNodeFs}`);
  }

  // -- public API -----------------------------------------------------------

  log(action: string, details: string, level: LogLevel = 'info') {
    const entry = this.formatEntry(level, action, details);
    this.writeEntry(entry);

    // Also mirror to console for dev convenience
    const consoleFn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    consoleFn(`[ProMarker] ${entry}`);
  }

  info(action: string, details: string) {
    this.log(action, details, 'info');
  }

  warn(action: string, details: string) {
    this.log(action, details, 'warn');
  }

  error(action: string, details: string) {
    this.log(action, details, 'error');
  }

  /** Returns the absolute path to the current log file (or '' in browser mode). */
  getLogPath(): string {
    return this.logFilePath;
  }

  /** Read the entire current log file contents. */
  readLogs(): string {
    if (this.useNodeFs && fs) {
      try {
        if (fs.existsSync(this.logFilePath)) {
          return fs.readFileSync(this.logFilePath, 'utf-8');
        }
      } catch {
        // fall through
      }
      return '';
    }

    // localStorage fallback
    try {
      return localStorage.getItem(LOCAL_STORAGE_KEY) || '';
    } catch {
      return '';
    }
  }

  /** Clear the current log file. */
  clearLogs() {
    if (this.useNodeFs && fs) {
      try {
        fs.writeFileSync(this.logFilePath, '', 'utf-8');
      } catch {
        // ignore
      }
      return;
    }

    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, '');
    } catch {
      // ignore
    }
  }

  /** Update the cached version string (e.g. after reading version.json). */
  setVersion(version: string) {
    this.version = version;
    if (this.useNodeFs && path) {
      this.logFilePath = path.join(this.logDir, `promarker_v${version}.log`);
    }
  }

  // -- internals ------------------------------------------------------------

  private readVersion(): string {
    // Attempt to read version.json via fetch or require.  Synchronous path
    // used only in Node/CEP context.
    try {
      if (fs && path && this.extensionPath) {
        const vPath = path.join(this.extensionPath, 'version.json');
        if (fs.existsSync(vPath)) {
          const data = JSON.parse(fs.readFileSync(vPath, 'utf-8'));
          return `${data.major}.${data.minor}.${data.patch}`;
        }
      }
    } catch {
      // ignore
    }
    return '1.0.1';
  }

  private formatEntry(level: LogLevel, action: string, details: string): string {
    const ts = new Date().toISOString();
    const lvl = level.toUpperCase().padEnd(5);
    return `[${ts}] [${lvl}] [v${this.version}] ${action}: ${details}`;
  }

  private writeEntry(entry: string) {
    if (this.useNodeFs && fs) {
      this.buffer.push(entry);
      this.scheduleFlush();
      return;
    }

    // localStorage fallback - append
    try {
      const existing = localStorage.getItem(LOCAL_STORAGE_KEY) || '';
      // Cap at ~500KB to avoid localStorage quota issues
      const combined = existing + entry + '\n';
      if (combined.length > 500_000) {
        const trimmed = combined.slice(combined.length - 400_000);
        localStorage.setItem(LOCAL_STORAGE_KEY, trimmed);
      } else {
        localStorage.setItem(LOCAL_STORAGE_KEY, combined);
      }
    } catch {
      // storage full or unavailable
    }
  }

  private scheduleFlush() {
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flush();
      this.flushTimer = null;
    }, 200);
  }

  private flush() {
    if (!this.useNodeFs || !fs || this.buffer.length === 0) return;
    try {
      const data = this.buffer.join('\n') + '\n';
      this.buffer = [];
      fs.appendFileSync(this.logFilePath, data, 'utf-8');
    } catch (e) {
      console.error('[ProMarker] Failed to flush logs:', e);
    }
  }

  private ensureLogDir() {
    if (!this.useNodeFs || !fs) return;
    try {
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true } as any);
      }
    } catch {
      // ignore
    }
  }
}

/** Singleton debug logger instance. */
export const debugLogger = new DebugLogger();
