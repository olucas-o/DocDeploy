import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

@Entity({ name: "organizations" })
export class Organization {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column({ length: 160 }) name!: string;
  @Column({ default: "active", length: 32 }) status!: string;
  @Column({ name: "retention_policy", type: "jsonb", default: () => "'{}'::jsonb" }) retentionPolicy!: Record<string, unknown>;
  @Column({ name: "ai_opt_in", default: false }) aiOptIn!: boolean;
  @CreateDateColumn({ name: "created_at", type: "timestamptz" }) createdAt!: Date;
  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" }) updatedAt!: Date;
}
