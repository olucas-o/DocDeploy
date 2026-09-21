import { NestFactory } from "@nestjs/core";

import { AppModule } from "../../src/app.module.js";
import { createOpenApiDocument } from "../../src/openapi/openapi.config.js";

describe("public OpenAPI contract", () => {
  it("declares bearer authentication and stable sanitized errors", async () => {
    const app = await NestFactory.create(AppModule, { logger: false });
    const document = createOpenApiDocument(app);
    expect(document.components?.securitySchemes?.bearer).toMatchObject({ scheme: "bearer", type: "http" });
    expect(document.components?.schemas?.Error).toMatchObject({ required: ["code", "message", "correlationId"] });
    await app.close();
  });

  it("does not publish secret-bearing schema properties", async () => {
    const app = await NestFactory.create(AppModule, { logger: false });
    const serialized = JSON.stringify(createOpenApiDocument(app)).toLowerCase();
    for (const forbidden of ["passwordhash", "refreshtoken", "storagekey", "openaiapikey", "stacktrace"]) {
      expect(serialized).not.toContain(forbidden);
    }
    await app.close();
  });
});
