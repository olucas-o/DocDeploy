import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

@Entity({ name: "review_tasks" })
@Index("ix_review_tasks_review_state", ["organizationId", "reviewId", "state"])
export class ReviewTask {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column({ name: "organization_id", type: "uuid" }) organizationId!: string;
  @Column({ name: "review_id", type: "uuid" }) reviewId!: string;
  @Column({ length: 255 }) title!: string;
  @Column({ name: "responsible_id", type: "uuid" }) responsibleId!: string;
  @Column({ name: "due_at", nullable: true, type: "timestamptz" }) dueAt!: Date | null;
  @Column({ default: "OPEN", length: 24 }) state!: string;
  @Column({ nullable: true, type: "text" }) resolution!: string | null;
  @Column({ name: "resolved_at", nullable: true, type: "timestamptz" }) resolvedAt!: Date | null;
  @CreateDateColumn({ name: "created_at", type: "timestamptz" }) createdAt!: Date;
  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" }) updatedAt!: Date;
}
