import type {
  ApiResponse,
  TokenPriceRequest,
  TokenPriceResponse,
  QuoteRequest,
  QuoteResponse,
  SubmitRequest,
  SubmitResponse,
  StatusResponse,
} from "./types";
import { SdkHttpError } from "./types";

/** Configuration for {@link HttpClient}. */
export interface HttpClientConfig {
  /** Base URL for the bundler REST API (e.g. `https://api.example.com/api/v1`). */
  apiBaseUrl: string;
  /** Optional Bearer token for bundler API authentication. */
  apiKey?: string;
  /** Request timeout in milliseconds (default: 30000). */
  timeout?: number;
}

/**
 * Low-level HTTP client for the bundler REST API.
 *
 * Uses the Fetch API and works in both Node.js and browser environments.
 * All responses are expected to follow the {@link ApiResponse} envelope format.
 *
 * @throws {@link SdkHttpError} on non-success responses, timeouts, or network errors.
 */
export class HttpClient {
  private baseUrl: string;
  private apiKey?: string;
  private timeout: number;

  constructor(config: HttpClientConfig) {
    this.baseUrl = config.apiBaseUrl.replace(/\/$/, "");
    this.apiKey = config.apiKey;
    this.timeout = config.timeout ?? 30_000;
  }

  private async request<T>(
    path: string,
    options: RequestInit & { searchParams?: Record<string, string> } = {}
  ): Promise<T> {
    const { searchParams, ...init } = options;
    // Keep base path: new URL("/x", "http://a/b") → "http://a/x", dropping /b. Use relative path so path is appended.
    const baseWithSlash = this.baseUrl.replace(/\/$/, "") + "/";
    const url = new URL(path.replace(/^\//, ""), baseWithSlash);
    if (searchParams) {
      Object.entries(searchParams).forEach(([k, v]) =>
        url.searchParams.set(k, v)
      );
    }
    const headers: Record<string, string> = {
      Accept: "application/json",
      ...((init.headers as Record<string, string>) ?? {}),
    };
    if (this.apiKey) headers["Authorization"] = `Bearer ${this.apiKey}`;
    if (
      init.body &&
      typeof init.body === "string" &&
      !headers["Content-Type"]
    ) {
      headers["Content-Type"] = "application/json";
    }
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);
    try {
      const res = await fetch(url.toString(), {
        ...init,
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const json = (await res.json()) as ApiResponse<T>;
      if (json.code !== 200) {
        throw new SdkHttpError(
          json.message ?? `HTTP ${res.status}`,
          res.status,
          JSON.stringify(json)
        );
      }
      if (res.status < 200 || res.status >= 300) {
        throw new SdkHttpError(
          json.message ?? `HTTP ${res.status}`,
          res.status,
          JSON.stringify(json)
        );
      }
      return (json.data ?? {}) as T;
    } catch (e) {
      clearTimeout(timeoutId);
      if (e instanceof SdkHttpError) throw e;
      if (e instanceof Error) {
        if (e.name === "AbortError") {
          throw new SdkHttpError(`Request timeout after ${this.timeout}ms`);
        }
        // Node fetch (undici) throws generic "fetch failed" with the real cause
        // attached as `error.cause`. Unwrap it so callers can see ECONNRESET /
        // ENOTFOUND / UND_ERR_SOCKET / certificate errors instead of a useless
        // top-level message.
        const parts: string[] = [e.message];
        let cause: unknown = (e as { cause?: unknown }).cause;
        while (cause) {
          if (cause instanceof Error) {
            const code = (cause as { code?: string }).code;
            parts.push(code ? `${cause.message} (${code})` : cause.message);
            cause = (cause as { cause?: unknown }).cause;
          } else {
            parts.push(String(cause));
            break;
          }
        }
        const detailed = parts.filter((p) => p && p.length > 0).join(" -> ");
        throw new SdkHttpError(
          `${detailed} [url=${url.toString()}]`
        );
      }
      throw new SdkHttpError("Unknown request error");
    }
  }

  /**
   * Fetch the token-per-ETH price from the bundler (`GET /bundler/price`).
   *
   * @param params - Token address to query.
   * @returns The token price response including rate and optional gas limits.
   */
  async getTokenPrice(
    params: TokenPriceRequest
  ): Promise<TokenPriceResponse> {
    return this.request<TokenPriceResponse>("/bundler/price", {
      method: "GET",
      searchParams: { token: params.token },
    });
  }

  /**
   * Request a gas quote from the bundler (`POST /bundler/quote`).
   *
   * @param req - Optional quote parameters (e.g. `batchSize`).
   * @returns Raw quote response with gas price components and limits.
   */
  async postQuote(req: QuoteRequest = {}): Promise<QuoteResponse> {
    return this.request<QuoteResponse>("/bundler/quote", {
      method: "POST",
      body: JSON.stringify(req),
    });
  }

  /**
   * Submit a signed UserOperation to the bundler (`POST /bundler/submit`).
   *
   * @param req - The full submit request payload including signature.
   * @returns Response containing the assigned `requestId`.
   */
  async postSubmit(req: SubmitRequest): Promise<SubmitResponse> {
    return this.request<SubmitResponse>("/bundler/submit", {
      method: "POST",
      body: JSON.stringify(req),
    });
  }

  /**
   * Query the status of a submitted operation (`GET /bundler/status/:id`).
   *
   * @param id - The request ID returned by {@link postSubmit}.
   * @returns Current status, optional transaction hash, and failure reason.
   */
  async getStatus(id: string): Promise<StatusResponse> {
    return this.request<StatusResponse>(`/bundler/status/${encodeURIComponent(id)}`, {
      method: "GET",
    });
  }
}
