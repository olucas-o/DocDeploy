import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

@Entity({ name: "reviews" })
@Index("ix_reviews_document_version", ["organizationId", "documentId", "documentVersionId"])
export class Review {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column({ name: "organization_id", type: "uuid" }) organizationId!: string;
  @Column({ name: "document_id", type: "uuid" }) documentId!: string;
  @Column({ name: "document_version_id", type: "uuid", unique: true }) documentVersionId!: string;
  @Column({ default: "PENDING", length: 32 }) state!: string;
  @Column({ name: "responsible_id", nullable: true, type: "uuid" }) responsibleId!: string | null;
  @Column({ nullable: true, length: 32 }) decision!: string | null;
  @Column({ nullable: true, type: "text" }) justification!: string | null;
  @Column({ name: "decided_at", nullable: true, type: "timestamptz" }) decidedAt!: Date | null;
  @CreateDateColumn({ name: "created_at", type: "timestamptz" }) createdAt!: Date;
  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" }) updatedAt!: Date;
}
