import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { decideFollowUp, type FollowUpState } from "./matter_decision.js";
import { InfraiError, infraiClientFromEnvironment } from "./infrai_media.js";

const intakeSchema = z.object({
  matter_id: z.string().min(1),
  client_name: z.string().min(1),
  image_keys: z.array(z.string().min(1)).min(1),
  signed_document_key: z.string().min(1),
  deadline: z.string().datetime({ offset: true })
});

type Intake = z.infer<typeof intakeSchema>;
type IndexedImage = { key: string; width: number; height: number; format: string };
type Matter = Intake & { images: IndexedImage[]; follow_up: FollowUpState };

const bucket = process.env.LEGAL_MEDIA_BUCKET ?? "legal-media-example";
const matters = new Map<string, Matter>();
const infrai = infraiClientFromEnvironment();

async function jsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function send(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body, null, 2));
}

async function indexMatter(input: Intake): Promise<Matter> {
  const available = new Set((await infrai.listObjects(bucket)).map((item) => item.key));
  const selected = input.image_keys.filter((key) => available.has(key));
  const images = await Promise.all(selected.map(async (key) => {
    const metadata = await infrai.readImageMetadata(bucket, key, `${input.matter_id}-${key}`);
    return { key, width: metadata.width, height: metadata.height, format: metadata.format };
  }));
  const matter = { ...input, images, follow_up: decideFollowUp(input.deadline, new Date()) };
  matters.set(input.matter_id, matter);
  return matter;
}

async function route(request: IncomingMessage, response: ServerResponse): Promise<void> {
  if (request.method === "POST" && request.url === "/matters/intake") {
    const parsed = intakeSchema.safeParse(await jsonBody(request));
    if (!parsed.success) return send(response, 400, { error: parsed.error.flatten() });
    return send(response, 201, await indexMatter(parsed.data));
  }

  const delivery = request.url?.match(/^\/matters\/([^/]+)\/delivery$/);
  if (request.method === "POST" && delivery) {
    const matterId = decodeURIComponent(delivery[1]);
    const matter = matters.get(matterId);
    if (!matter) return send(response, 404, { error: "Matter not found" });
    const download_url = await infrai.presignDownload(
      bucket,
      matter.signed_document_key,
      `${matterId}-${randomUUID()}`
    );
    return send(response, 200, { matter_id: matterId, download_url, expires_seconds: 900 });
  }

  if (request.method === "GET" && request.url === "/matters/follow-up") {
    const now = new Date();
    const follow_up = [...matters.values()].map((matter) => ({
      matter_id: matter.matter_id,
      deadline: matter.deadline,
      state: decideFollowUp(matter.deadline, now)
    }));
    return send(response, 200, { follow_up });
  }

  send(response, 404, { error: "Route not found" });
}

await infrai.createBucket(bucket);

const server = createServer((request, response) => {
  route(request, response).catch((error: unknown) => {
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      send(response, status, { error: error.code });
      return;
    }
    if (error instanceof z.ZodError) {
      send(response, 502, { error: "Unexpected upstream response" });
      return;
    }
    send(response, 500, { error: error instanceof Error ? error.message : "Unexpected error" });
  });
});

const port = Number(process.env.PORT ?? 3000);
server.listen(port, () => console.log(`Legal media service listening on http://localhost:${port}`));
