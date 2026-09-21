import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import { CreateDocumentDto } from "../../src/modules/documents/dto/create-document.dto.js";
import { ConfirmUploadDto } from "../../src/modules/document-versions/dto/confirm-upload.dto.js";

describe("documents public contract", () => {
  it("accepts the minimum document metadata and supported file contract", async () => {
    const document = plainToInstance(CreateDocumentDto, {
      name: "Contrato 2026",
      type: "contract",
      origin: "Fornecedor A",
      receivedAt: "2026-09-21T12:00:00.000Z",
      responsibleId: "11111111-1111-4111-8111-111111111111",
      fileName: "contrato.pdf",
      contentType: "application/pdf",
      size: 25 * 1024 * 1024,
      sha256: "a".repeat(64),
    });
    expect(await validate(document)).toEqual([]);
  });

  it("rejects an unsupported type and an oversized upload confirmation", async () => {
    const confirmation = plainToInstance(ConfirmUploadDto, {
      sha256: "a".repeat(64), contentType: "application/zip", size: 25 * 1024 * 1024 + 1,
    });
    const errors = await validate(confirmation);
    expect(errors.map((error) => error.property)).toEqual(expect.arrayContaining(["contentType", "size"]));
  });
});
