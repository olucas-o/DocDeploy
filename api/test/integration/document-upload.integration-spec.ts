import { BadRequestException } from "@nestjs/common";

import { validateUploadConfirmation } from "../../src/modules/document-versions/document-versions.service.js";
import { validateUploadedObjectMetadata } from "../../src/modules/storage/storage.service.js";

describe("document upload boundary", () => {
  it.each(["application/pdf", "image/png", "image/jpeg"])("accepts %s up to 25 MB", (contentType) => {
    expect(() => validateUploadConfirmation({ contentType, size: 25 * 1024 * 1024, sha256: "a".repeat(64) })).not.toThrow();
  });

  it.each([
    { contentType: "application/zip", size: 10, sha256: "a".repeat(64) },
    { contentType: "application/pdf", size: 25 * 1024 * 1024 + 1, sha256: "a".repeat(64) },
    { contentType: "application/pdf", size: 10, sha256: "not-a-hash" },
  ])("rejects unsafe metadata %#", (input) => {
    expect(() => validateUploadConfirmation(input)).toThrow(BadRequestException);
  });

  it("rejects bytes whose client metadata claims the expected hash but S3 checksum differs", () => {
    expect(() => validateUploadedObjectMetadata({
      ContentLength: 10,
      ContentType: "application/pdf",
      ChecksumSHA256: Buffer.from("b".repeat(64), "hex").toString("base64"),
      Metadata: { sha256: "a".repeat(64) },
    }, { contentType: "application/pdf", size: 10, sha256: "a".repeat(64) })).toThrow("does not match");
  });
});
