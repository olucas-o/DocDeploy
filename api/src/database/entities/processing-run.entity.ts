import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from "typeorm";

@Entity({ name: "processing_runs" })
@Unique("uq_processing_run_version_operation", ["organizationId", "documentVersionId", "operation", "processorVersion"])
@Index("ix_processing_runs_state_created", ["organizationId", "state", "createdAt"])
export class ProcessingRun {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column({ name: "organization_id", type: "uuid" }) organizationId!: string;
  @Column({ name: "document_version_id", type: "uuid" }) documentVersionId!: string;
  @Column({ length: 48 }) operation!: string;
  @Column({ name: "processor_version", length: 64 }) processorVersion!: string;
  @Column({ name: "idempotency_key", unique: true, length: 255 }) idempotencyKey!: string;
  @Column({ name: "bull_job_id", nullable: true, length: 255 }) bullJobId!: string | null;
  @Column({ default: "QUEUED", length: 32 }) state!: string;
  @Column({ nullable: true, length: 48 }) stage!: string | null;
  @Column({ default: 0, type: "smallint" }) progress!: number;
  @Column({ default: 0, type: "smallint" }) attempts!: number;
  @Column({ name: "correlation_id", type: "uuid" }) correlationId!: string;
  @Column({ name: "sanitized_error", nullable: true, type: "jsonb" }) sanitizedError!: Record<string, unknown> | null;
  @CreateDateColumn({ name: "created_at", type: "timestamptz" }) createdAt!: Date;
  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" }) updatedAt!: Date;
}
