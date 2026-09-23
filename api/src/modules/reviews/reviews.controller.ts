import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "@nestjs/passport";
import type { Request } from "express";

import type { AuthenticatedPrincipal } from "../../common/auth/jwt.strategy.js";
import { OrganizationContextGuard } from "../../common/authorization/organization-context.guard.js";
import { PermissionGuard } from "../../common/authorization/permission.guard.js";
import { RequirePermissions } from "../../common/authorization/permissions.decorator.js";
import { CorrectFieldDto } from "./dto/correct-field.dto.js";
import { CreateReviewTaskDto } from "./dto/create-review-task.dto.js";
import { ResolveReviewTaskDto } from "./dto/resolve-review-task.dto.js";
import { ReviewDecisionDto } from "./dto/review-decision.dto.js";
import { ReviewsService } from "./reviews.service.js";

type AuthRequest = Request & { user: AuthenticatedPrincipal; correlationId?: string };
const fallbackCorrelation = "00000000-0000-4000-8000-000000000000";

@ApiTags("reviews") @ApiBearerAuth("bearer")
@Controller()
@UseGuards(AuthGuard("jwt"), OrganizationContextGuard, PermissionGuard)
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get("document-versions/:id/review") @RequirePermissions("reviews:read")
  findByDocumentVersion(@Req() request: AuthRequest, @Param("id") documentVersionId: string) {
    return this.reviews.findByDocumentVersion(request.user.organizationId, documentVersionId);
  }

  @Patch("extracted-fields/:id") @RequirePermissions("reviews:correct-field")
  correctField(@Req() request: AuthRequest, @Param("id") fieldId: string, @Body() body: CorrectFieldDto) {
    return this.reviews.correctField(request.user.organizationId, request.user.userId, request.correlationId ?? fallbackCorrelation, fieldId, body);
  }

  @Post("reviews/:id/tasks") @RequirePermissions("reviews:manage-tasks")
  createTask(@Req() request: AuthRequest, @Param("id") reviewId: string, @Body() body: CreateReviewTaskDto) {
    return this.reviews.createTask(request.user.organizationId, request.user.userId, request.correlationId ?? fallbackCorrelation, reviewId, body);
  }

  @Patch("review-tasks/:id") @RequirePermissions("reviews:manage-tasks")
  resolveTask(@Req() request: AuthRequest, @Param("id") taskId: string, @Body() body: ResolveReviewTaskDto) {
    return this.reviews.resolveTask(request.user.organizationId, request.user.userId, request.correlationId ?? fallbackCorrelation, taskId, body);
  }

  @Post("reviews/:id/decision") @RequirePermissions("reviews:decide")
  decide(@Req() request: AuthRequest, @Param("id") reviewId: string, @Body() body: ReviewDecisionDto) {
    return this.reviews.decide(request.user.organizationId, request.user.userId, request.correlationId ?? fallbackCorrelation, reviewId, body);
  }
}
