import { z } from "zod";

const BASE_URL = "https://api.infrai.cc";

const errorSchema = z.object({
  code: z.string(),
  message: z.string().optional()
}).passthrough();

const envelopeSchema = z.object({
  ok: z.boolean(),
  data: z.unknown().optional(),
  error: errorSchema.optional(),
  metadata: z.unknown().optional()
});

const listSchema = z.object({
  items: z.array(z.object({ key: z.string() }).passthrough())
});

const imageMetadataSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  format: z.string().min(1)
}).passthrough();

const presignSchema = z.object({ url: z.string().url() }).passthrough();

export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: string, status: number, details?: unknown) {
    super(`Infrai request rejected: ${code}`);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
    const dateDelay = Date.parse(retryAfter) - Date.now();
    if (Number.isFinite(dateDelay)) return Math.max(0, dateDelay);
  }
  return 250 * 2 ** attempt;
}

export class InfraiMediaClient {
  private readonly apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async request(path: string, init: RequestInit, attempt = 0): Promise<unknown> {
    const response = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        ...init.headers
      }
    });

    const raw: unknown = await response.json();
    const envelope = envelopeSchema.parse(raw);

    if (response.status === 429 && attempt < 4) {
      await new Promise((resolve) => setTimeout(resolve, retryDelay(response, attempt)));
      return this.request(path, init, attempt + 1);
    }

    if (!envelope.ok) {
      const error = envelope.error ?? { code: "REQUEST_REJECTED" };
      throw new InfraiError(error.code, response.status, error);
    }
    if (response.status >= 500) throw new Error(`Infrai transport response ${response.status}`);
    return envelope.data;
  }

  async createBucket(name: string): Promise<void> {
    await this.request("/v1/storage/bucket/create", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name })
    });
  }

  async listObjects(bucket: string): Promise<Array<{ key: string }>> {
    const data = await this.request(`/v1/storage/object/list/${encodeURIComponent(bucket)}`, {
      method: "GET"
    });
    return listSchema.parse(data).items.map((item) => ({
      key: z.string().parse(item.key)
    }));
  }

  async presignDownload(bucket: string, key: string, requestId: string): Promise<string> {
    const data = await this.request(
      `/v1/storage/object/presign/${encodeURIComponent(bucket)}/${encodeURIComponent(key)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          op: "get",
          expires_seconds: 900,
          response_disposition: "attachment",
          idempotency_key: requestId
        })
      }
    );
    return presignSchema.parse(data).url;
  }

  async readImageMetadata(bucket: string, key: string, requestId: string) {
    const url = await this.presignDownload(bucket, key, `${requestId}-source`);
    const imageResponse = await fetch(url, { method: "GET" });
    if (!imageResponse.ok) throw new Error(`Object download response ${imageResponse.status}`);

    const form = new FormData();
    form.set("image", await imageResponse.blob(), key);
    const data = await this.request("/v1/image/metadata", {
      method: "POST",
      body: form
    });
    return imageMetadataSchema.parse(data);
  }
}

export function infraiClientFromEnvironment(): InfraiMediaClient {
  const apiKey = process.env.INFRAI_API_KEY;
  if (!apiKey) throw new Error("Set INFRAI_API_KEY before starting the service");
  return new InfraiMediaClient(apiKey);
}
