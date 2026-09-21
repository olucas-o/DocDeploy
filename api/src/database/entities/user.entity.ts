import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

@Entity({ name: "users" })
export class User {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column({ name: "normalized_email", unique: true, length: 320 }) normalizedEmail!: string;
  @Column({ length: 160 }) name!: string;
  @Column({ default: "active", length: 32 }) status!: string;
  @Column({ name: "password_hash", nullable: true, select: false, type: "text" }) passwordHash!: string | null;
  @CreateDateColumn({ name: "created_at", type: "timestamptz" }) createdAt!: Date;
  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" }) updatedAt!: Date;
}
