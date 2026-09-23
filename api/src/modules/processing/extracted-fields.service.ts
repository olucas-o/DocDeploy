import { Injectable } from "@nestjs/common";
import type { EntityManager } from "typeorm";

import { ExtractedField } from "../../database/entities/extracted-field.entity.js";

export const REQUIRED_FIELD_KEYS = ["identifier", "issuer", "relevant_date", "value"] as const;
export type RequiredFieldKey = typeof REQUIRED_FIELD_KEYS[number];

export const CONFIDENCE_REVIEW_THRESHOLD = 0.8;

export type ExtractedFieldSource = "local" | "ocr" | "ai" | "human";

export interface RawExtractedField {
  key: string;
  value: string | null;
  source?: ExtractedFieldSource;
  page?: number | null;
  excerpt?: string | null;
  confidence?: number | null;
}

export interface NormalizedExtractedField {
  key: string;
  value: string | null;
  source: ExtractedFieldSource;
  page: number | null;
  excerpt: string | null;
  confidence: number | null;
  reviewState: "UNREVIEWED" | "NEEDS_REVIEW";
}

/** A field with no value, or with low confidence, must be flagged for human review instead of silently accepted. */
export function classifyReviewState(field: Pick<RawExtractedField, "value" | "confidence">): "UNREVIEWED" | "NEEDS_REVIEW" {
  if (field.value === null || field.value === undefined || field.value.trim().length === 0) return "NEEDS_REVIEW";
  if (typeof field.confidence === "number" && field.confidence < CONFIDENCE_REVIEW_THRESHOLD) return "NEEDS_REVIEW";
  return "UNREVIEWED";
}

/**
 * Guarantees the minimum governance field set (identifier, issuer/origin, relevant date and value)
 * is always represented, even when the worker could not find a match: missing fields are kept as
 * empty placeholders explicitly marked for review instead of being silently dropped.
 */
export function buildFieldRecords(rawFields: RawExtractedField[]): NormalizedExtractedField[] {
  const byKey = new Map<string, RawExtractedField>();
  for (const field of rawFields) {
    if (field.key.trim().length === 0) continue;
    byKey.set(field.key, field);
  }
  const keys = new Set<string>([...REQUIRED_FIELD_KEYS, ...byKey.keys()]);
  return [...keys].map((key) => {
    const raw = byKey.get(key) ?? { key, value: null };
    const normalized: NormalizedExtractedField = {
      key,
      value: raw.value ?? null,
      source: raw.source ?? "local",
      page: raw.page ?? null,
      excerpt: raw.excerpt ?? null,
      confidence: raw.confidence ?? null,
      reviewState: "UNREVIEWED",
    };
    normalized.reviewState = classifyReviewState(normalized);
    return normalized;
  });
}

@Injectable()
export class ExtractedFieldsService {
  /**
   * Persists the normalized field set for a document version. Fields are upserted by
   * (documentVersionId, key): a field that already exists from a previous run is refreshed only
   * while it has not been reviewed by a human, so an automatic re-run never overwrites a
   * human-authored correction (see `correctField` in reviews.service.ts for that path).
   */
  async persist(manager: EntityManager, organizationId: string, documentVersionId: string, rawFields: RawExtractedField[]): Promise<ExtractedField[]> {
    const records = buildFieldRecords(rawFields);
    const persisted: ExtractedField[] = [];
    for (const record of records) {
      const existing = await manager.findOne(ExtractedField, { where: { organizationId, documentVersionId, key: record.key } });
      if (existing && existing.source === "human") {
        persisted.push(existing);
        continue;
      }
      if (existing) {
        existing.value = record.value;
        existing.source = record.source;
        existing.page = record.page;
        existing.excerpt = record.excerpt;
        existing.confidence = record.confidence;
        existing.reviewState = record.reviewState;
        persisted.push(await manager.save(existing));
      } else {
        const created = manager.create(ExtractedField, {
          organizationId,
          documentVersionId,
          key: record.key,
          value: record.value,
          originalValue: record.value,
          previousValues: [],
          source: record.source,
          page: record.page,
          excerpt: record.excerpt,
          confidence: record.confidence,
          reviewState: record.reviewState,
          reviewerId: null,
        });
        persisted.push(await manager.save(created));
      }
    }
    return persisted;
  }
}
