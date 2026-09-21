import "reflect-metadata";
import { DataSource } from "typeorm";

import { AuditEvent } from "./entities/audit-event.entity.js";
import { Document } from "./entities/document.entity.js";
import { DocumentVersion } from "./entities/document-version.entity.js";
import { ExtractedField } from "./entities/extracted-field.entity.js";
import { Notification } from "./entities/notification.entity.js";
import { Organization } from "./entities/organization.entity.js";
import { OrganizationMembership } from "./entities/organization-membership.entity.js";
import { OutboxEvent } from "./entities/outbox-event.entity.js";
import { ProcessingRun } from "./entities/processing-run.entity.js";
import { Review } from "./entities/review.entity.js";
import { ReviewComment } from "./entities/review-comment.entity.js";
import { ReviewTask } from "./entities/review-task.entity.js";
import { Session } from "./entities/session.entity.js";
import { StoredArtifact } from "./entities/stored-artifact.entity.js";
import { User } from "./entities/user.entity.js";
import { BaseTenancy001 } from "./migrations/001-base-tenancy.js";
import { AuditProtection002 } from "./migrations/002-audit-protection.js";
import { ProcessingClaims0025 } from "./migrations/0025-processing-claims.js";
import { Documents003 } from "./migrations/003-documents.js";
import { ReviewsAndExtraction004 } from "./migrations/004-reviews-and-extraction.js";

export const entities = [Organization, User, OrganizationMembership, Session, AuditEvent, OutboxEvent, Notification, ProcessingRun, Document, DocumentVersion, StoredArtifact, ExtractedField, Review, ReviewTask, ReviewComment];
export const migrations = [BaseTenancy001, AuditProtection002, ProcessingClaims0025, Documents003, ReviewsAndExtraction004];
const migrationUrl = process.env.MIGRATIONS_DATABASE_URL ?? process.env.DATABASE_URL;

export default new DataSource({
  type: "postgres",
  ...(migrationUrl
    ? { url: migrationUrl }
    : { host: "127.0.0.1", port: 5432, database: "docdeploy", username: "docdeploy_app", password: "not-configured" }),
  entities,
  migrations,
  synchronize: false,
});
