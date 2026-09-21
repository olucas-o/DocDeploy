import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

@Entity({ name: "documents" })
@Index("ix_documents_search", ["organizationId", "type", "status", "responsibleId", "receivedAt"])
export class Document {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column({ name: "organization_id", type: "uuid" }) organizationId!: string;
  @Column({ length: 255 }) name!: string;
  @Column({ length: 32 }) type!: "contract" | "invoice" | "certificate" | "report" | "registration";
  @Column({ length: 255 }) origin!: string;
  @Column({ name: "responsible_id", type: "uuid" }) responsibleId!: string;
  @Column({ default: "UPLOADING", length: 32 }) status!: string;
  @Column({ name: "received_at", type: "timestamptz" }) receivedAt!: Date;
  @Column({ name: "current_version_id", nullable: true, type: "uuid" }) currentVersionId!: string | null;
  @CreateDateColumn({ name: "created_at", type: "timestamptz" }) createdAt!: Date;
  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" }) updatedAt!: Date;
}
