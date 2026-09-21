import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Injectable } from "@nestjs/common";

const permittedZones = new Set(["quarantine", "clean", "derived"]);

export function validateUploadedObjectMetadata(head: { ContentLength?: number | undefined; ContentType?: string | undefined; ChecksumSHA256?: string | undefined; Metadata?: Record<string, string> | undefined }, expected: { contentType: string; sha256: string; size: number }): void {
  const expectedBase64 = Buffer.from(expected.sha256, "hex").toString("base64");
  if (head.ContentLength !== expected.size || head.ContentType !== expected.contentType || head.ChecksumSHA256 !== expectedBase64) {
    throw new Error("Uploaded object metadata does not match the signed request");
  }
}

@Injectable()
export class StorageService {
  private readonly bucket = process.env.S3_BUCKET ?? "docdeploy-private";
  private readonly client = new S3Client({
    ...(process.env.S3_ENDPOINT ? { endpoint: process.env.S3_ENDPOINT, forcePathStyle: true } : {}),
    region: process.env.S3_REGION ?? "us-east-1",
    ...(process.env.S3_ACCESS_KEY && process.env.S3_SECRET_KEY
      ? { credentials: { accessKeyId: process.env.S3_ACCESS_KEY, secretAccessKey: process.env.S3_SECRET_KEY } }
      : {}),
  });

  assertTenantKey(organizationId: string, key: string): void {
    const [zone, tenant] = key.split("/");
    if (!zone || !permittedZones.has(zone) || tenant !== organizationId || key.includes("..")) throw new Error("Invalid object key");
  }

  async createUploadUrl(organizationId: string, key: string, contentType: string, sha256: string, size: number): Promise<{ url: string; headers: Record<string, string> }> {
    this.assertTenantKey(organizationId, key);
    if (!key.startsWith("quarantine/")) throw new Error("Uploads must target quarantine");
    const checksum = Buffer.from(sha256, "hex").toString("base64");
    const url = await getSignedUrl(this.client, new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: contentType, ChecksumSHA256: checksum, Metadata: { sha256 } }), { expiresIn: 300 });
    return { url, headers: { "content-type": contentType, "x-amz-checksum-sha256": checksum, "x-amz-meta-sha256": sha256 } };
  }

  async verifyUploadedObject(organizationId: string, key: string, expected: { contentType: string; sha256: string; size: number; versionId?: string }): Promise<void> {
    this.assertTenantKey(organizationId, key);
    const head = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key, ...(expected.versionId ? { VersionId: expected.versionId } : {}), ChecksumMode: "ENABLED" }));
    validateUploadedObjectMetadata(head, expected);
  }

  async createReadUrl(organizationId: string, key: string): Promise<string> {
    this.assertTenantKey(organizationId, key);
    if (key.startsWith("quarantine/")) throw new Error("Quarantined objects cannot be read");
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), { expiresIn: 300 });
  }
}
