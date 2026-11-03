import fs from "node:fs";
import path from "node:path";
import type { ProviderId } from "../../src/types/domain.ts";

export interface ServerConfig {
  nodeEnv: "development" | "test" | "production";
  port: number;
  sqliteDbPath: string;
  provider: ProviderId;
  liteApi: {
    apiKey: string;
    dataBaseUrl: string;
    bookBaseUrl: string;
    checkoutReturnUrl: string;
  };
  duffel: {
    accessToken: string;
    baseUrl: string;
  };
  requestTimeoutMs: number;
  rateLimitMaxPerMinute: number;
}

export function loadDotEnvFile(
  envFilePath: string = typeof process !== "undefined" && typeof process.cwd === "function"
    ? path.resolve(process.cwd(), ".env")
    : ".env"
): void {
  try {
    if (!fs.existsSync(envFilePath)) return;
    const content = fs.readFileSync(envFilePath, "utf8");
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const eqIndex = line.indexOf("=");
      if (eqIndex <= 0) continue;
      const key = line.slice(0, eqIndex).trim();
      let value = line.slice(eqIndex + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  } catch {
    // Edge or read-only serverless runtimes inject env vars via platform bindings rather than .env files
  }
}

export function readServerConfig(overrides: Partial<ServerConfig> = {}): ServerConfig {
  loadDotEnvFile();

  // Security guard: ensure no supplier secret is leaked via EXPO_PUBLIC_*
  for (const key of Object.keys(process.env)) {
    if (
      key.startsWith("EXPO_PUBLIC_") &&
      /(SECRET|TOKEN|API_KEY|LITEAPI_KEY|DUFFEL)/i.test(key) &&
      process.env[key]
    ) {
      throw new Error(
        `Security violation: privileged credential '${key}' must not use the EXPO_PUBLIC_ prefix.`
      );
    }
  }

  const rawEnv = process.env.NODE_ENV ?? "development";
  const nodeEnv: ServerConfig["nodeEnv"] =
    rawEnv === "production" || rawEnv === "test" ? rawEnv : "development";

  const rawProvider = (process.env.GOWILD_PROVIDER ?? "development_fixtures").trim();
  if (
    rawProvider !== "liteapi" &&
    rawProvider !== "duffel" &&
    rawProvider !== "development_fixtures"
  ) {
    throw new Error(
      `Invalid GOWILD_PROVIDER '${rawProvider}'. Expected 'liteapi', 'duffel', or 'development_fixtures'.`
    );
  }

  const base: ServerConfig = {
    nodeEnv,
    port: Number(process.env.PORT ?? 4010),
    sqliteDbPath: process.env.SQLITE_DB_PATH ?? "./server/data/gowild.sqlite",
    provider: rawProvider,
    liteApi: {
      apiKey: (process.env.LITEAPI_KEY ?? "").trim(),
      dataBaseUrl: (
        process.env.LITEAPI_DATA_BASE_URL ?? "https://api.liteapi.travel/v3.0"
      ).replace(/\/+$/, ""),
      bookBaseUrl: (
        process.env.LITEAPI_BOOK_BASE_URL ?? "https://book.liteapi.travel/v3.0"
      ).replace(/\/+$/, ""),
      checkoutReturnUrl:
        process.env.LITEAPI_CHECKOUT_RETURN_URL ?? "gowild://booking/confirmation",
    },
    duffel: {
      accessToken: (process.env.DUFFEL_ACCESS_TOKEN ?? "").trim(),
      baseUrl: (process.env.DUFFEL_BASE_URL ?? "https://api.duffel.com").replace(
        /\/+$/,
        ""
      ),
    },
    requestTimeoutMs: Number(process.env.REQUEST_TIMEOUT_MS ?? 12000),
    rateLimitMaxPerMinute: Number(process.env.RATE_LIMIT_PER_MIN ?? 120),
  };

  const merged: ServerConfig = {
    ...base,
    ...overrides,
    liteApi: { ...base.liteApi, ...overrides.liteApi },
    duffel: { ...base.duffel, ...overrides.duffel },
  };

  if (merged.nodeEnv === "production" && merged.provider === "development_fixtures") {
    throw new Error(
      "GOWILD_PROVIDER=development_fixtures is strictly prohibited when NODE_ENV=production."
    );
  }

  return merged;
}

