import { processingJobSchema } from "../../src/modules/processing/processing-job.schema.js";
import { bullJobId } from "../../src/modules/processing/outbox-publisher.service.js";

const validJob = {
  schemaVersion: 1,
  jobKind: "document.virus_scan",
  correlationId: "a22a25ce-a3b8-45fa-a818-290a7d38c36d",
  traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
  idempotencyKey: "org-1:version-1:scan:v1",
  tenantId: "11111111-1111-4111-8111-111111111111",
  documentId: "22222222-2222-4222-8222-222222222222",
  documentVersionId: "33333333-3333-4333-8333-333333333333",
  source: {
    bucket: "docdeploy-private",
    key: "quarantine/11111111-1111-4111-8111-111111111111/version-1/source.pdf",
    versionId: "object-version-1",
    sha256: "a".repeat(64),
    contentType: "application/pdf",
  },
  processing: { processorVersion: "scan-v1", ocrLanguages: ["por"] },
  requestedAt: "2026-09-21T12:00:00.000Z",
};

describe("document-processing.v1 contract", () => {
  it("accepts the versioned compact command", () => {
    expect(processingJobSchema.parse(validJob)).toMatchObject(validJob);
  });

  it("derives a Redis-safe deterministic job id from the full idempotency key", () => {
    const id = bullJobId(validJob.idempotencyKey);
    expect(id).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(id).not.toContain(":");
    expect(bullJobId(validJob.idempotencyKey)).toBe(id);
  });

  it.each(["binary", "text", "url", "localPath", "jwt", "refreshToken", "storageCredentials", "openAiApiKey"])(
    "rejects forbidden payload field %s",
    (field) => {
      expect(() => processingJobSchema.parse({ ...validJob, [field]: "secret" })).toThrow();
    },
  );
});
