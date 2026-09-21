import { buildDocumentSearch } from "../../src/modules/documents/documents.service.js";

describe("document search isolation", () => {
  it("always scopes the query to the session organization", () => {
    const search = buildDocumentSearch("11111111-1111-4111-8111-111111111111", {
      name: "contrato", type: "contract", status: "UPLOADING", responsibleId: "22222222-2222-4222-8222-222222222222",
      receivedFrom: "2026-01-01", receivedTo: "2026-12-31", hasPendingTasks: false,
    });
    expect(search.organizationId).toBe("11111111-1111-4111-8111-111111111111");
    expect(search).not.toHaveProperty("tenantId");
  });

  it("does not accept organizationId from client filters", () => {
    const search = buildDocumentSearch("org-session", { organizationId: "org-attacker" } as never);
    expect(search.organizationId).toBe("org-session");
  });
});
