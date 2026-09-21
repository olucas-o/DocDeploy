import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

@Entity({ name: "extracted_fields" })
@Index("ix_extracted_fields_version", ["organizationId", "documentVersionId"])
export class ExtractedField {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column({ name: "organization_id", type: "uuid" }) organizationId!: string;
  @Column({ name: "document_version_id", type: "uuid" }) documentVersionId!: string;
  @Column({ name: "field_key", length: 64 }) key!: string;
  @Column({ name: "typed_value", nullable: true, type: "jsonb" }) value!: unknown;
  @Column({ name: "original_value", nullable: true, type: "jsonb" }) originalValue!: unknown;
  @Column({ name: "previous_values", type: "jsonb", default: () => "'[]'::jsonb" }) previousValues!: unknown[];
  @Column({ length: 24 }) source!: "local" | "ocr" | "ai" | "human";
  @Column({ nullable: true, type: "integer" }) page!: number | null;
  @Column({ nullable: true, type: "text" }) excerpt!: string | null;
  @Column({ nullable: true, type: "real" }) confidence!: number | null;
  @Column({ name: "review_state", default: "UNREVIEWED", length: 32 }) reviewState!: string;
  @Column({ name: "reviewer_id", nullable: true, type: "uuid" }) reviewerId!: string | null;
  @CreateDateColumn({ name: "created_at", type: "timestamptz" }) createdAt!: Date;
  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" }) updatedAt!: Date;
}
