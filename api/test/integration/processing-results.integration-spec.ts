import { BadRequestException } from "@nestjs/common";

import { applyProcessingTransition, deduplicateProcessingResult } from "../../src/modules/processing/processing-results.service.js";

describe("processing result persistence", () => {
  it("accepts monotonic transitions and rejects stale events", () => {
    expect(applyProcessingTransition("QUEUED", "ACTIVE")).toBe("ACTIVE");
    expect(applyProcessingTransition("ACTIVE", "COMPLETED")).toBe("COMPLETED");
    expect(() => applyProcessingTransition("COMPLETED", "ACTIVE")).toThrow(BadRequestException);
  });

  it("returns the previous compact result for the same idempotency key and checksum", () => {
    const previous = { idempotencyKey: "key-1", checksum: "a".repeat(64), artifactRefs: ["artifact-1"] };
    expect(deduplicateProcessingResult(previous, { idempotencyKey: "key-1", checksum: "a".repeat(64) })).toBe(previous);
    expect(() => deduplicateProcessingResult(previous, { idempotencyKey: "key-1", checksum: "b".repeat(64) })).toThrow(BadRequestException);
  });
});
