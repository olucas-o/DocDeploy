import { Injectable } from "@nestjs/common";
import type { EntityManager } from "typeorm";

import { AuditEvent } from "../../database/entities/audit-event.entity.js";
import { Notification } from "../../database/entities/notification.entity.js";

const businessNotificationTypes: Record<string, string> = {
  "document.created": "document_received",
  "document.version_created": "document_version_created",
  "review_task.created": "review_task_created",
  "review.decided": "review_decided",
};

@Injectable()
export class NotificationsService {
  /** Queue an in-app notification only after the corresponding audit event exists in this transaction. */
  async fromBusinessEvent(manager: EntityManager, event: AuditEvent, recipientId: string | null): Promise<Notification | null> {
    const type = businessNotificationTypes[event.action];
    if (!type || !recipientId) return null;
    const notification = manager.create(Notification, {
      organizationId: event.organizationId, recipientId, channel: "in_app", type, state: "PENDING",
      resourceType: event.resourceType, resourceId: event.resourceId, attempts: 0,
    });
    return manager.save(notification);
  }
}
