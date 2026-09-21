import type { INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import type { OpenAPIObject } from "@nestjs/swagger";

export function createOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle("DocDeploy API")
    .setDescription("Multi-tenant document governance API")
    .setVersion("1.0")
    .addBearerAuth(undefined, "bearer")
    .build();
  const document = SwaggerModule.createDocument(app, config);
  document.components ??= {};
  document.components.schemas ??= {};
  document.components.schemas.Error = {
    type: "object",
    additionalProperties: false,
    required: ["code", "message", "correlationId"],
    properties: {
      code: { type: "string" }, message: { type: "string" }, correlationId: { type: "string", format: "uuid" },
    },
  };
  return document;
}

export function configureOpenApi(app: INestApplication): void {
  const document = createOpenApiDocument(app);
  if (process.env.NODE_ENV === "development" || process.env.ENABLE_SWAGGER === "true") {
    SwaggerModule.setup("api/docs", app, document);
  }
}
