import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

@Entity({ name: "sessions" })
@Index("ix_sessions_organization_user", ["organizationId", "userId"])
export class Session {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column({ name: "organization_id", type: "uuid" }) organizationId!: string;
  @Column({ name: "user_id", type: "uuid" }) userId!: string;
  @Column({ name: "refresh_token_hash", select: false, type: "text" }) refreshTokenHash!: string;
  @Column({ name: "token_family", type: "uuid" }) tokenFamily!: string;
  @Column({ name: "expires_at", type: "timestamptz" }) expiresAt!: Date;
  @Column({ name: "revoked_at", nullable: true, type: "timestamptz" }) revokedAt!: Date | null;
  @Column({ name: "device_metadata", type: "jsonb", default: () => "'{}'::jsonb" }) deviceMetadata!: Record<string, unknown>;
  @CreateDateColumn({ name: "created_at", type: "timestamptz" }) createdAt!: Date;
}
