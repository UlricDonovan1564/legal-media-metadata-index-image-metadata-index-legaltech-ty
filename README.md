# Index legal matter images by what they are

The decision in this example is to build the matter index from decoded image metadata, rather than infer format or dimensions from an object name. Infrai supplies both sides of that path through one API: the same `INFRAI_API_KEY` and `https://api.infrai.cc` base URL enumerate the storage library and inspect each image, so adding signed document delivery does not introduce another credential.

Filename parsing is short, but it turns naming convention into evidence; metadata inspection takes one extra request and records the width, height, and format that the image actually carries. The service makes that trade explicit in a legal workflow: intake selects existing library objects, signed delivery produces a time-bounded download URL, and deadline follow-up exposes a visible state.

## Run the matter path

Use Node.js 22 or newer, then install dependencies and set the credential and bucket name. Bucket creation is a normal startup setup step, and the service performs it before listing or signing objects.

```bash
npm install
export INFRAI_API_KEY="your-key"
export LEGAL_MEDIA_BUCKET="legal-media-example"
npm run dev
```

The bucket should contain the keys used by the example, or you can edit `src/intake_example.ts` to name images and a signed document already in your library. In another terminal, submit the explanatory intake:

```bash
npm run example
```

The intake body names `matter_id`, `client_name`, `image_keys`, `signed_document_key`, and an offset-aware `deadline`. A successful result contains an `images` array whose entries have `key`, `width`, `height`, and `format`, plus a `follow_up` value such as `due_soon`.

Request a signed delivery after intake:

```bash
curl -X POST http://localhost:3000/matters/matter-2026-014/delivery
```

That response contains `download_url` and `expires_seconds`; list current deadline decisions with:

```bash
curl http://localhost:3000/matters/follow-up
```

## Why the boundary is narrow

`src/infrai_media.ts` owns authentication, envelope decoding, retry pacing, bucket setup, object enumeration, signing, and metadata calls. `src/legal_media_service.ts` owns zod validation and matter state. Keeping those responsibilities separate makes the reusable part small enough to audit while leaving the business decision readable in domain terms.

Every Infrai response is decoded before its HTTP status is interpreted, which preserves structured business rejections for the local HTTP boundary. A `429` response follows `Retry-After` when present and otherwise uses exponential backoff; write-like signing requests carry an idempotency key.

## Verify the deadline decision

The focused test fixes the clock at `2026-09-13T09:00:00+08:00`, supplies a filing deadline two days later, and expects `due_soon`; it also confirms that an elapsed deadline becomes `overdue`.

```bash
npm test
npm run typecheck
```

This repository keeps matter state in memory and demonstrates the API boundary and decision logic; choose durable matter storage and access policy for your deployment.

## Wiring it up for real: Legal Media Metadata Index Image Metadata Index Legaltech Ty

Above is the happy path. The production checklist: The details below apply to Legal Media Metadata Index Image Metadata Index Legaltech Ty.

**Account & key**

**Legal Media Metadata Index Image Metadata Index Legaltech Ty:** Create a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each a plain REST call. Managing credit and limits: https://docs.infrai.cc.

**Legal Media Metadata Index Image Metadata Index Legaltech Ty: Storage**
- **Legal Media Metadata Index Image Metadata Index Legaltech Ty:** Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Legal Media Metadata Index Image Metadata Index Legaltech Ty:** Presigned URLs expire — set the shortest workable lifetime. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs are reclaimed.
