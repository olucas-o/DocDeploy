import { z } from "zod";

const sourceSchema = z.object({
  bucket: z.string().min(1),
  key: z.string().regex(/^(quarantine|clean|derived)\/[a-zA-Z0-9-]+\/[a-zA-Z0-9/_\-.]+$/),
  versionId: z.string().min(1).optional(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/i),
  contentType: z.enum(["application/pdf", "image/png", "image/jpeg"]),
}).strict();

export const processingJobSchema = z.object({
  schemaVersion: z.literal(1),
  jobKind: z.enum(["document.virus_scan", "document.extract", "document.ocr", "document.analyze"]),
  correlationId: z.uuid(),
  traceparent: z.string().regex(/^00-[a-f0-9]{32}-[a-f0-9]{16}-[a-f0-9]{2}$/i),
  idempotencyKey: z.string().min(1).max(255),
  tenantId: z.uuid(), documentId: z.uuid(), documentVersionId: z.uuid(),
  source: sourceSchema,
  processing: z.object({ processorVersion: z.string().min(1), ocrLanguages: z.array(z.string().regex(/^[a-z]{3}$/)).max(5) }).strict(),
  requestedAt: z.iso.datetime(),
}).strict();

export type ProcessingJob = z.infer<typeof processingJobSchema>;
