import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique } from "typeorm";

@Entity({ name: "stored_artifacts" })
@Unique("uq_stored_artifact_key", ["organizationId", "objectKey"])
@Index("ix_artifacts_document_version", ["organizationId", "documentVersionId"])
export class StoredArtifact {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column({ name: "organization_id", type: "uuid" }) organizationId!: string;
  @Column({ name: "document_version_id", type: "uuid" }) documentVersionId!: string;
  @Column({ length: 16 }) zone!: "quarantine" | "clean" | "derived";
  @Column({ name: "object_key", length: 1024 }) objectKey!: string;
  @Column({ length: 64 }) sha256!: string;
  @Column({ type: "bigint" }) size!: string;
  @Column({ name: "content_type", length: 64 }) contentType!: string;
  @Column({ length: 32 }) origin!: "upload" | "processor";
  @Column({ name: "retention_until", nullable: true, type: "timestamptz" }) retentionUntil!: Date | null;
  @CreateDateColumn({ name: "created_at", type: "timestamptz" }) createdAt!: Date;
}
