import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique } from "typeorm";

@Entity({ name: "outbox_events" })
@Unique("uq_outbox_idempotency", ["organizationId", "idempotencyKey"])
@Index("ix_outbox_unpublished", ["publishedAt", "createdAt"])
export class OutboxEvent {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column({ name: "organization_id", type: "uuid" }) organizationId!: string;
  @Column({ name: "event_type", length: 96 }) eventType!: string;
  @Column({ name: "schema_version", type: "smallint" }) schemaVersion!: number;
  @Column({ type: "jsonb" }) payload!: Record<string, unknown>;
  @Column({ name: "idempotency_key", length: 255 }) idempotencyKey!: string;
  @Column({ name: "published_at", nullable: true, type: "timestamptz" }) publishedAt!: Date | null;
  @Column({ name: "claimed_at", nullable: true, type: "timestamptz" }) claimedAt!: Date | null;
  @Column({ name: "claim_token", nullable: true, type: "uuid" }) claimToken!: string | null;
  @Column({ name: "failure_message", nullable: true, type: "text" }) failureMessage!: string | null;
  @CreateDateColumn({ name: "created_at", type: "timestamptz" }) createdAt!: Date;
}
