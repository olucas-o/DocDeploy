import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { EntityManager } from "typeorm";

import { ExtractedField } from "../../database/entities/extracted-field.entity.js";
import { OrganizationMembership } from "../../database/entities/organization-membership.entity.js";
import { Review } from "../../database/entities/review.entity.js";
import { ReviewComment } from "../../database/entities/review-comment.entity.js";
import { ReviewTask } from "../../database/entities/review-task.entity.js";
import { TenantTransactionService } from "../../database/tenant-transaction.service.js";
import { AuditService } from "../audit/audit.service.js";
import type { CorrectFieldDto } from "./dto/correct-field.dto.js";
import type { CreateReviewTaskDto } from "./dto/create-review-task.dto.js";
import { reviewDecisions, type ReviewDecisionDto } from "./dto/review-decision.dto.js";
import type { ResolveReviewTaskDto } from "./dto/resolve-review-task.dto.js";

const decisionsRequiringJustification = new Set(["REJECTED", "RETURNED_FOR_COMPLEMENT"]);

/** Rejecting or returning a review for complement must always carry an auditable reason. */
export function validateReviewDecision(decision: string, justification: string | undefined): void {
  if (!reviewDecisions.includes(decision as typeof reviewDecisions[number])) throw new BadRequestException("Unknown review decision");
  if (decisionsRequiringJustification.has(decision) && !justification?.trim()) {
    throw new BadRequestException("A justification is required to reject or return a review");
  }
}

/** A human correction of an extracted field must always explain why it was changed. */
export function validateFieldCorrection(input: { value: string; justification: string | undefined }): void {
  if (!input.justification?.trim()) throw new BadRequestException("A justification is required to correct an extracted field");
}

@Injectable()
export class ReviewsService {
  constructor(private readonly transactions: TenantTransactionService, private readonly audit: AuditService) {}

  async findByDocumentVersion(organizationId: string, documentVersionId: string): Promise<{ review: Review | null; fields: ExtractedField[]; tasks: ReviewTask[] }> {
    return this.transactions.run(organizationId, async (manager) => {
      const review = await manager.findOne(Review, { where: { organizationId, documentVersionId } });
      const fields = await manager.find(ExtractedField, { where: { organizationId, documentVersionId }, order: { key: "ASC" } });
      const tasks = review ? await manager.find(ReviewTask, { where: { organizationId, reviewId: review.id }, order: { createdAt: "ASC" } }) : [];
      return { review, fields, tasks };
    });
  }

  /**
   * Corrects an extracted field with an audited, non-destructive write: the previous value and
   * origin are appended to `previousValues` instead of being overwritten, so the extraction
   * history remains reconstructable.
   */
  async correctField(organizationId: string, actorId: string, correlationId: string, fieldId: string, dto: CorrectFieldDto): Promise<ExtractedField> {
    validateFieldCorrection({ value: dto.value, justification: dto.justification });
    return this.transactions.run(organizationId, async (manager) => {
      const field = await manager.findOne(ExtractedField, { where: { id: fieldId, organizationId } });
      if (!field) throw new NotFoundException("Extracted field not found");
      const history = Array.isArray(field.previousValues) ? field.previousValues : [];
      history.push({ value: field.value, source: field.source, reviewerId: field.reviewerId, recordedAt: new Date().toISOString() });
      field.previousValues = history;
      field.value = dto.value;
      field.source = "human";
      field.excerpt = dto.excerpt ?? field.excerpt;
      field.reviewState = "CORRECTED";
      field.reviewerId = actorId;
      const saved = await manager.save(field);
      await this.audit.append(manager, {
        organizationId, actorId, actorType: "human", action: "extracted_field.corrected", resourceType: "extractedField",
        resourceId: field.id, result: "accepted", reason: dto.justification, correlationId,
        metadata: { documentVersionId: field.documentVersionId, key: field.key },
      });
      return saved;
    });
  }

  /** Opens a review pendency assigned to a responsible member, with an optional due date. */
  async createTask(organizationId: string, actorId: string, correlationId: string, reviewId: string, dto: CreateReviewTaskDto): Promise<ReviewTask> {
    return this.transactions.run(organizationId, async (manager) => {
      const review = await manager.findOne(Review, { where: { id: reviewId, organizationId } });
      if (!review) throw new NotFoundException("Review not found");
      const responsibleIsMember = await manager.exists(OrganizationMembership, { where: { organizationId, userId: dto.responsibleId, status: "active" } });
      if (!responsibleIsMember) throw new NotFoundException("Responsible member not found");
      const task = manager.create(ReviewTask, {
        organizationId, reviewId, title: dto.title, responsibleId: dto.responsibleId,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : null, state: "OPEN", resolution: null, resolvedAt: null,
      });
      const saved = await manager.save(task);
      if (review.state === "PENDING") { review.state = "IN_REVIEW"; await manager.save(review); }
      await this.audit.append(manager, {
        organizationId, actorId, actorType: "human", action: "review_task.created", resourceType: "reviewTask",
        resourceId: saved.id, result: "accepted", correlationId, metadata: { reviewId },
      });
      return saved;
    });
  }

  /** Resolves (or cancels) a pendency; a resolution message and timestamp are always required. */
  async resolveTask(organizationId: string, actorId: string, correlationId: string, taskId: string, dto: ResolveReviewTaskDto): Promise<ReviewTask> {
    return this.transactions.run(organizationId, async (manager) => {
      const task = await manager.findOne(ReviewTask, { where: { id: taskId, organizationId } });
      if (!task) throw new NotFoundException("Review task not found");
      if (task.state !== "OPEN") throw new BadRequestException("Only open tasks can be resolved");
      task.state = dto.state;
      task.resolution = dto.resolution;
      task.resolvedAt = new Date();
      const saved = await manager.save(task);
      await manager.insert(ReviewComment, {
        organizationId, reviewId: task.reviewId, reviewTaskId: task.id, authorId: actorId, message: dto.resolution, extractedFieldId: null,
      });
      await this.audit.append(manager, {
        organizationId, actorId, actorType: "human", action: "review_task.resolved", resourceType: "reviewTask",
        resourceId: task.id, result: dto.state.toLowerCase(), reason: dto.resolution, correlationId, metadata: { reviewId: task.reviewId },
      });
      return saved;
    });
  }

  /**
   * Authorized decision on a review: approve, reject or return for complement. Rejecting or
   * returning always requires a justification, and no decision is allowed while pendencies remain
   * open.
   */
  async decide(organizationId: string, actorId: string, correlationId: string, reviewId: string, dto: ReviewDecisionDto): Promise<Review> {
    validateReviewDecision(dto.decision, dto.justification);
    return this.transactions.run(organizationId, async (manager) => {
      const review = await manager.findOne(Review, { where: { id: reviewId, organizationId } });
      if (!review) throw new NotFoundException("Review not found");
      if (review.state === "APPROVED" || review.state === "REJECTED") throw new BadRequestException("Review already has a final decision");
      const openTasks = await manager.count(ReviewTask, { where: { organizationId, reviewId, state: "OPEN" } });
      if (openTasks > 0) throw new BadRequestException("Review has open pendencies");
      const stateByDecision: Record<string, string> = { APPROVED: "APPROVED", REJECTED: "REJECTED", RETURNED_FOR_COMPLEMENT: "CHANGES_REQUESTED" };
      review.state = stateByDecision[dto.decision] ?? review.state;
      review.decision = dto.decision;
      review.justification = dto.justification ?? null;
      review.decidedAt = new Date();
      review.responsibleId = review.responsibleId ?? actorId;
      const saved = await manager.save(review);
      await this.audit.append(manager, {
        organizationId, actorId, actorType: "human", action: "review.decided", resourceType: "review",
        resourceId: review.id, result: dto.decision.toLowerCase(), correlationId,
        metadata: { documentVersionId: review.documentVersionId },
        ...(dto.justification ? { reason: dto.justification } : {}),
      });
      return saved;
    });
  }
}
