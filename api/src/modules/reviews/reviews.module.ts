import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { AuditEvent } from "../../database/entities/audit-event.entity.js";
import { ExtractedField } from "../../database/entities/extracted-field.entity.js";
import { OrganizationMembership } from "../../database/entities/organization-membership.entity.js";
import { Review } from "../../database/entities/review.entity.js";
import { ReviewComment } from "../../database/entities/review-comment.entity.js";
import { ReviewTask } from "../../database/entities/review-task.entity.js";
import { DatabaseModule } from "../../database/database.module.js";
import { AuditService } from "../audit/audit.service.js";
import { ReviewsController } from "./reviews.controller.js";
import { ReviewsService } from "./reviews.service.js";

@Module({
  imports: [DatabaseModule, TypeOrmModule.forFeature([Review, ReviewTask, ReviewComment, ExtractedField, OrganizationMembership, AuditEvent])],
  controllers: [ReviewsController],
  providers: [ReviewsService, AuditService],
})
export class ReviewsModule {}
