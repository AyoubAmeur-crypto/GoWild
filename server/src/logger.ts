export interface LogEntry {
  timestamp: string;
  level: "info" | "warn" | "error";
  event: string;
  requestId?: string;
  meta?: Record<string, unknown>;
}

const REDACT_KEYS = /password|secret|token|authorization|api[-_]?key/i;

function sanitizeMeta(meta?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!meta) return undefined;
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(meta)) {
    if (REDACT_KEYS.test(key)) {
      clean[key] = "[REDACTED]";
    } else {
      clean[key] = value;
    }
  }
  return clean;
}

export function createLogger(silent: boolean = process.env.NODE_ENV === "test") {
  const write = (level: LogEntry["level"], event: string, meta?: Record<string, unknown>) => {
    if (silent && level !== "error") return;
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      event,
      meta: sanitizeMeta(meta),
    };
    const line = JSON.stringify(entry);
    if (level === "error") {
      console.error(line);
    } else {
      console.log(line);
    }
  };

  return {
    info: (event: string, meta?: Record<string, unknown>) => write("info", event, meta),
    warn: (event: string, meta?: Record<string, unknown>) => write("warn", event, meta),
    error: (event: string, meta?: Record<string, unknown>) => write("error", event, meta),
  };
}

