import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique } from "typeorm";

@Entity({ name: "document_versions" })
@Unique("uq_document_version_number", ["documentId", "number"])
@Unique("uq_document_version_hash", ["documentId", "sha256"])
@Index("ix_document_versions_organization_document", ["organizationId", "documentId"])
export class DocumentVersion {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column({ name: "organization_id", type: "uuid" }) organizationId!: string;
  @Column({ name: "document_id", type: "uuid" }) documentId!: string;
  @Column({ type: "integer" }) number!: number;
  @Column({ nullable: true, type: "varchar", length: 64 }) sha256!: string | null;
  @Column({ nullable: true, type: "bigint" }) size!: string | null;
  @Column({ name: "detected_type", nullable: true, length: 64 }) detectedType!: string | null;
  @Column({ name: "object_key", length: 1024 }) objectKey!: string;
  @Column({ name: "object_version_id", nullable: true, length: 255 }) objectVersionId!: string | null;
  @Column({ default: "UPLOADING", length: 40 }) state!: string;
  @Column({ name: "created_by", type: "uuid" }) createdBy!: string;
  @Column({ name: "replacement_reason", nullable: true, type: "text" }) replacementReason!: string | null;
  @CreateDateColumn({ name: "created_at", type: "timestamptz" }) createdAt!: Date;
}
