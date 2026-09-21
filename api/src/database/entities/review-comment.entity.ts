import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

@Entity({ name: "review_comments" })
@Index("ix_review_comments_review", ["organizationId", "reviewId", "createdAt"])
export class ReviewComment {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column({ name: "organization_id", type: "uuid" }) organizationId!: string;
  @Column({ name: "review_id", type: "uuid" }) reviewId!: string;
  @Column({ name: "review_task_id", nullable: true, type: "uuid" }) reviewTaskId!: string | null;
  @Column({ name: "author_id", type: "uuid" }) authorId!: string;
  @Column({ type: "text" }) message!: string;
  @Column({ name: "extracted_field_id", nullable: true, type: "uuid" }) extractedFieldId!: string | null;
  @CreateDateColumn({ name: "created_at", type: "timestamptz" }) createdAt!: Date;
}
