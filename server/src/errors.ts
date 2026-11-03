export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "PROVIDER_NOT_CONFIGURED"
  | "PROVIDER_CAPABILITY_UNSUPPORTED"
  | "PROVIDER_UPSTREAM_ERROR"
  | "OFFER_EXPIRED"
  | "OFFER_SOLD_OUT"
  | "INTERNAL_ERROR";

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: ApiErrorCode;
  public readonly details?: Record<string, unknown>;

  constructor(
    statusCode: number,
    code: ApiErrorCode,
    message: string,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export class ProviderNotConfiguredError extends AppError {
  constructor(providerName: string, missingEnvVar: string) {
    super(
      503,
      "PROVIDER_NOT_CONFIGURED",
      `${providerName} is selected as the active hotel provider, but '${missingEnvVar}' is not configured on the BFF server.`,
      { providerName, missingEnvVar }
    );
  }
}

export class ProviderUpstreamError extends AppError {
  constructor(providerName: string, upstreamStatus: number, message: string) {
    super(
      upstreamStatus >= 500 ? 502 : 422,
      "PROVIDER_UPSTREAM_ERROR",
      `${providerName} request failed (${upstreamStatus}): ${message}`,
      { providerName, upstreamStatus }
    );
  }
}

