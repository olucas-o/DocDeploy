import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique } from "typeorm";

@Entity({ name: "audit_events" })
@Unique("uq_audit_organization_sequence", ["organizationId", "sequence"])
@Index("ix_audit_resource_created", ["organizationId", "resourceType", "resourceId", "createdAt"])
export class AuditEvent {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column({ name: "organization_id", type: "uuid" }) organizationId!: string;
  @Column({ type: "bigint" }) sequence!: string;
  @Column({ name: "previous_hash", nullable: true, type: "varchar", length: 64 }) previousHash!: string | null;
  @Column({ name: "current_hash", type: "varchar", length: 64 }) currentHash!: string;
  @Column({ name: "actor_id", nullable: true, type: "uuid" }) actorId!: string | null;
  @Column({ name: "actor_type", length: 16 }) actorType!: "human" | "service";
  @Column({ length: 96 }) action!: string;
  @Column({ name: "resource_type", length: 64 }) resourceType!: string;
  @Column({ name: "resource_id", type: "uuid" }) resourceId!: string;
  @Column({ nullable: true, type: "integer" }) version!: number | null;
  @Column({ length: 32 }) result!: string;
  @Column({ nullable: true, type: "text" }) reason!: string | null;
  @Column({ name: "correlation_id", type: "uuid" }) correlationId!: string;
  @Column({ type: "jsonb", default: () => "'{}'::jsonb" }) metadata!: Record<string, unknown>;
  @CreateDateColumn({ name: "created_at", type: "timestamptz" }) createdAt!: Date;
}
