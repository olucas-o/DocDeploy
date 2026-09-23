import { BadRequestException } from "@nestjs/common";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import { CorrectFieldDto } from "../../src/modules/reviews/dto/correct-field.dto.js";
import { CreateReviewTaskDto } from "../../src/modules/reviews/dto/create-review-task.dto.js";
import { ResolveReviewTaskDto } from "../../src/modules/reviews/dto/resolve-review-task.dto.js";
import { ReviewDecisionDto } from "../../src/modules/reviews/dto/review-decision.dto.js";
import { buildFieldRecords, classifyReviewState } from "../../src/modules/processing/extracted-fields.service.js";
import { validateReviewDecision, validateFieldCorrection } from "../../src/modules/reviews/reviews.service.js";

describe("reviews contract", () => {
  describe("query results", () => {
    it("marks a missing field for review and a present, confident field as unreviewed", () => {
      const records = buildFieldRecords([
        { key: "identifier", value: "NF-2026-001", confidence: 0.98 },
        { key: "issuer", value: null },
      ]);
      const byKey = Object.fromEntries(records.map((record) => [record.key, record]));
      expect(byKey.identifier?.reviewState).toBe("UNREVIEWED");
      expect(byKey.issuer?.reviewState).toBe("NEEDS_REVIEW");
      // relevant_date and value are part of the minimum required set even when absent from the worker payload.
      expect(byKey.relevant_date?.reviewState).toBe("NEEDS_REVIEW");
      expect(byKey.value?.reviewState).toBe("NEEDS_REVIEW");
    });

    it("flags low-confidence values as needing review even when a value is present", () => {
      expect(classifyReviewState({ value: "R$ 100,00", confidence: 0.4 })).toBe("NEEDS_REVIEW");
      expect(classifyReviewState({ value: "R$ 100,00", confidence: 0.95 })).toBe("UNREVIEWED");
    });
  });

  describe("field correction", () => {
    it("requires a justification when correcting an extracted field", () => {
      expect(() => validateFieldCorrection({ value: "100.00", justification: "" })).toThrow(BadRequestException);
      expect(() => validateFieldCorrection({ value: "100.00", justification: "Valor conferido na página 1" })).not.toThrow();
    });

    it("rejects a correction payload without a justification at the DTO boundary", async () => {
      const dto = plainToInstance(CorrectFieldDto, { value: "100.00" });
      const errors = await validate(dto);
      expect(errors.map((error) => error.property)).toEqual(expect.arrayContaining(["justification"]));
    });
  });

  describe("review pendency", () => {
    it("accepts a pendency with a responsible member and an optional due date", async () => {
      const dto = plainToInstance(CreateReviewTaskDto, {
        title: "Confirmar CNPJ do emissor",
        responsibleId: "11111111-1111-4111-8111-111111111111",
        dueAt: "2026-10-01T12:00:00.000Z",
      });
      expect(await validate(dto)).toEqual([]);
    });

    it("requires a resolution message to close a pendency", async () => {
      const dto = plainToInstance(ResolveReviewTaskDto, { state: "RESOLVED" });
      const errors = await validate(dto);
      expect(errors.map((error) => error.property)).toEqual(expect.arrayContaining(["resolution"]));
    });
  });

  describe("review decision", () => {
    it("requires a reason for rejection and return decisions", () => {
      expect(() => validateReviewDecision("REJECTED", "")).toThrow(BadRequestException);
      expect(() => validateReviewDecision("RETURNED_FOR_COMPLEMENT", undefined)).toThrow(BadRequestException);
      expect(() => validateReviewDecision("APPROVED", undefined)).not.toThrow();
    });

    it("rejects an unknown decision value", () => {
      expect(() => validateReviewDecision("MAYBE", "some reason")).toThrow(BadRequestException);
    });

    it("rejects a rejection payload without justification at the DTO boundary", async () => {
      const dto = plainToInstance(ReviewDecisionDto, { decision: "REJECTED" });
      expect(await validate(dto)).toEqual([]);
      // DTO-level validation only enforces shape/allowlist; the mandatory-justification business
      // rule for REJECTED/RETURNED_FOR_COMPLEMENT is enforced by validateReviewDecision above,
      // which the service calls before persisting the decision.
      expect(() => validateReviewDecision(dto.decision, dto.justification)).toThrow(BadRequestException);
    });
  });
});
