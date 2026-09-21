import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from "typeorm";

@Entity({ name: "organization_memberships" })
@Unique("uq_membership_organization_user", ["organizationId", "userId"])
@Index("ix_membership_organization_status", ["organizationId", "status"])
export class OrganizationMembership {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column({ name: "organization_id", type: "uuid" }) organizationId!: string;
  @Column({ name: "user_id", type: "uuid" }) userId!: string;
  @Column({ length: 32 }) role!: "administrator" | "collaborator" | "reviewer" | "auditor";
  @Column({ type: "text", array: true, default: () => "ARRAY[]::text[]" }) permissions!: string[];
  @Column({ default: "active", length: 32 }) status!: string;
  @CreateDateColumn({ name: "created_at", type: "timestamptz" }) createdAt!: Date;
  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" }) updatedAt!: Date;
}
