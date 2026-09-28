import { apiRequest } from "../../services/api-client";
import type { ReviewCommentSummary, ReviewField, ReviewTaskSummary } from "./ReviewPanel";

export interface ReviewData { review: { id: string; state: string } | null; fields: ReviewField[]; tasks: ReviewTaskSummary[]; comments: ReviewCommentSummary[]; }

export function getReview(versionId: string): Promise<ReviewData> { return apiRequest(`/document-versions/${encodeURIComponent(versionId)}/review`); }
export function correctField(fieldId: string, value: string, justification: string): Promise<unknown> {
  return apiRequest(`/extracted-fields/${encodeURIComponent(fieldId)}`, { method: "PATCH", body: JSON.stringify({ value, justification }) });
}
export function createReviewTask(reviewId: string, title: string, responsibleId?: string): Promise<unknown> {
  return apiRequest(`/reviews/${encodeURIComponent(reviewId)}/tasks`, { method: "POST", body: JSON.stringify({ title, ...(responsibleId ? { responsibleId } : {}) }) });
}
export function resolveReviewTask(taskId: string, resolution: string): Promise<unknown> {
  return apiRequest(`/review-tasks/${encodeURIComponent(taskId)}`, { method: "PATCH", body: JSON.stringify({ state: "RESOLVED", resolution }) });
}
export function addReviewComment(reviewId: string, message: string): Promise<unknown> {
  return apiRequest(`/reviews/${encodeURIComponent(reviewId)}/comments`, { method: "POST", body: JSON.stringify({ message }) });
}
export function decideReview(reviewId: string, decision: "APPROVED" | "REJECTED" | "RETURNED_FOR_COMPLEMENT", justification?: string): Promise<unknown> {
  return apiRequest(`/reviews/${encodeURIComponent(reviewId)}/decision`, { method: "POST", body: JSON.stringify({ decision, ...(justification ? { justification } : {}) }) });
}
