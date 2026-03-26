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

export interface HttpClientConfig {
  apiBaseUrl: string;
  apiKey?: string;
  timeout?: number;
}

/**
 * HTTP client for bundler REST API.
 * Works in both Node.js and browser (uses fetch).
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
        throw new SdkHttpError(e.message);
      }
      throw new SdkHttpError("Unknown request error");
    }
  }

  /** GET /bundler/price?token=0x... */
  async getTokenPrice(
    params: TokenPriceRequest
  ): Promise<TokenPriceResponse> {
    return this.request<TokenPriceResponse>("/bundler/price", {
      method: "GET",
      searchParams: { token: params.token },
    });
  }

  /** POST /bundler/quote */
  async postQuote(req: QuoteRequest = {}): Promise<QuoteResponse> {
    return this.request<QuoteResponse>("/bundler/quote", {
      method: "POST",
      body: JSON.stringify(req),
    });
  }

  /** POST /bundler/submit */
  async postSubmit(req: SubmitRequest): Promise<SubmitResponse> {
    return this.request<SubmitResponse>("/bundler/submit", {
      method: "POST",
      body: JSON.stringify(req),
    });
  }

  /** GET /bundler/status/:id */
  async getStatus(id: string): Promise<StatusResponse> {
    return this.request<StatusResponse>(`/bundler/status/${encodeURIComponent(id)}`, {
      method: "GET",
    });
  }
}
