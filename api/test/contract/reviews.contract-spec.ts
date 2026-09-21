import { BadRequestException } from "@nestjs/common";

import { validateReviewDecision, validateFieldCorrection } from "../../src/modules/reviews/reviews.service.js";

describe("reviews contract", () => {
  it("requires a reason for rejection and return decisions", () => {
    expect(() => validateReviewDecision("REJECTED", "")).toThrow(BadRequestException);
    expect(() => validateReviewDecision("RETURNED_FOR_COMPLEMENT", undefined)).toThrow(BadRequestException);
    expect(() => validateReviewDecision("APPROVED", undefined)).not.toThrow();
  });

  it("requires a justification when correcting an extracted field", () => {
    expect(() => validateFieldCorrection({ value: "100.00", justification: "" })).toThrow(BadRequestException);
    expect(() => validateFieldCorrection({ value: "100.00", justification: "Valor conferido na página 1" })).not.toThrow();
  });
});
