import type { ServerConfig } from "../config.ts";
import type { FetchLike } from "../httpClient.ts";
import type { HotelProvider } from "../../../src/services/providers/types.ts";
import { LiteApiProvider } from "./liteApiProvider.ts";
import { DuffelStaysProvider } from "./duffelStaysProvider.ts";
import { ExplicitDevFixtureProvider } from "./devFixtureProvider.ts";

/**
 * Resolves the single active HotelProvider configured in ServerConfig.
 * Strict rule: NEVER falls back silently to ExplicitDevFixtureProvider when
 * 'liteapi' or 'duffel' is selected.
 */
export function createHotelProvider(
  config: ServerConfig,
  fetchFn?: FetchLike
): HotelProvider {
  switch (config.provider) {
    case "liteapi":
      return new LiteApiProvider({
        apiKey: config.liteApi.apiKey,
        dataBaseUrl: config.liteApi.dataBaseUrl,
        bookBaseUrl: config.liteApi.bookBaseUrl,
        checkoutReturnUrl: config.liteApi.checkoutReturnUrl,
        timeoutMs: config.requestTimeoutMs,
        fetchFn,
      });

    case "duffel":
      return new DuffelStaysProvider({
        accessToken: config.duffel.accessToken,
        baseUrl: config.duffel.baseUrl,
        timeoutMs: config.requestTimeoutMs,
        fetchFn,
      });

    case "development_fixtures":
      return new ExplicitDevFixtureProvider();
  }
}
