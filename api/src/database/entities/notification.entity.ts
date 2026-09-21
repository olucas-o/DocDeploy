import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

@Entity({ name: "notifications" })
@Index("ix_notifications_recipient_state", ["organizationId", "recipientId", "state"])
export class Notification {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column({ name: "organization_id", type: "uuid" }) organizationId!: string;
  @Column({ name: "recipient_id", type: "uuid" }) recipientId!: string;
  @Column({ length: 24 }) channel!: string;
  @Column({ length: 64 }) type!: string;
  @Column({ length: 24 }) state!: string;
  @Column({ name: "resource_type", length: 64 }) resourceType!: string;
  @Column({ name: "resource_id", type: "uuid" }) resourceId!: string;
  @Column({ default: 0, type: "smallint" }) attempts!: number;
  @CreateDateColumn({ name: "created_at", type: "timestamptz" }) createdAt!: Date;
}
