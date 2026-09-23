import { BadRequestException } from "@nestjs/common";

import { bullJobId } from "../../src/modules/processing/outbox-publisher.service.js";
import {
  applyProcessingTransition,
  deduplicateProcessingResult,
  PROCESSING_RUN_TRANSITIONS,
} from "../../src/modules/processing/processing-results.service.js";

describe("processing result persistence", () => {
  describe("run idempotency and retry", () => {
    it("accepts monotonic transitions and rejects stale events", () => {
      expect(applyProcessingTransition("QUEUED", "ACTIVE")).toBe("ACTIVE");
      expect(applyProcessingTransition("ACTIVE", "COMPLETED")).toBe("COMPLETED");
      expect(() => applyProcessingTransition("COMPLETED", "ACTIVE")).toThrow(BadRequestException);
    });

    it("allows a queued run to be retried through RETRY_SCHEDULED back to ACTIVE, and finally dead-lettered", () => {
      expect(applyProcessingTransition("ACTIVE", "RETRY_SCHEDULED")).toBe("RETRY_SCHEDULED");
      expect(applyProcessingTransition("RETRY_SCHEDULED", "ACTIVE")).toBe("ACTIVE");
      expect(applyProcessingTransition("RETRY_SCHEDULED", "DEAD_LETTERED")).toBe("DEAD_LETTERED");
    });

    it("never allows a terminal state to move again, matching the durable transition table", () => {
      for (const terminal of ["COMPLETED", "FAILED", "DEAD_LETTERED", "CANCELLED"]) {
        expect(PROCESSING_RUN_TRANSITIONS[terminal]).toBeUndefined();
        expect(() => applyProcessingTransition(terminal, "ACTIVE")).toThrow(BadRequestException);
      }
    });

    it("rejects an unknown target state outright", () => {
      expect(() => applyProcessingTransition("QUEUED", "SUSPENDED")).toThrow(BadRequestException);
    });

    it("derives the same deterministic Bull job id across retries of the same idempotency key", () => {
      const key = "org-1:version-1:document.extract:extract-v1";
      expect(bullJobId(key)).toBe(bullJobId(key));
    });
  });

  describe("compact result and single persistence", () => {
    it("returns the previous compact result for the same idempotency key and checksum (at-least-once delivery)", () => {
      const previous = { idempotencyKey: "key-1", checksum: "a".repeat(64), artifactRefs: ["artifact-1"] };
      expect(deduplicateProcessingResult(previous, { idempotencyKey: "key-1", checksum: "a".repeat(64) })).toBe(previous);
    });

    it("rejects a re-delivery under the same key whose checksum diverges from what was persisted", () => {
      const previous = { idempotencyKey: "key-1", checksum: "a".repeat(64), artifactRefs: ["artifact-1"] };
      expect(() => deduplicateProcessingResult(previous, { idempotencyKey: "key-1", checksum: "b".repeat(64) })).toThrow(BadRequestException);
    });

    it("rejects a result whose idempotency key does not match the persisted run", () => {
      const previous = { idempotencyKey: "key-1", checksum: "a".repeat(64), artifactRefs: ["artifact-1"] };
      expect(() => deduplicateProcessingResult(previous, { idempotencyKey: "key-2", checksum: "a".repeat(64) })).toThrow(BadRequestException);
    });

    it("keeps the compact result free of binaries: only references, hashes and small counters travel", () => {
      const compact = { idempotencyKey: "key-1", checksum: "a".repeat(64), artifactRefs: ["clean/org/version/hash-v1.pdf"], extractedDataRef: "derived/org/version/hash-v1-extracted.json", pageCount: 3, fieldCount: 4, durationMs: 1200 };
      expect(Object.keys(compact)).not.toEqual(expect.arrayContaining(["binary", "text", "content"]));
      expect(JSON.stringify(compact).length).toBeLessThan(1024);
    });
  });
});
