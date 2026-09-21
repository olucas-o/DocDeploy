import { ForbiddenException } from "@nestjs/common";

import { assertTenantMatch } from "../../src/common/authorization/organization-context.guard.js";
import { hashRefreshToken, verifyRefreshToken } from "../../src/modules/auth/auth.service.js";

describe("tenant and session isolation", () => {
  it("rejects a resource from another organization without disclosing it", () => {
    expect(() => assertTenantMatch("org-a", "org-b")).toThrow(ForbiddenException);
  });

  it("stores only a slow refresh-token hash that can be verified", async () => {
    const token = "opaque-refresh-token";
    const hash = await hashRefreshToken(token);
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(hash).not.toContain(token);
    await expect(verifyRefreshToken(hash, token)).resolves.toBe(true);
    await expect(verifyRefreshToken(hash, "replayed-token")).resolves.toBe(false);
  });
});
