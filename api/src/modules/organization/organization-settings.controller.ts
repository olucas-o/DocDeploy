import { Body, Controller, NotFoundException, Patch, Req, UseGuards } from "@nestjs/common";
import { IsBoolean } from "class-validator";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "@nestjs/passport";
import type { Request } from "express";

import type { AuthenticatedPrincipal } from "../../common/auth/jwt.strategy.js";
import { OrganizationContextGuard } from "../../common/authorization/organization-context.guard.js";
import { PermissionGuard } from "../../common/authorization/permission.guard.js";
import { RequirePermissions } from "../../common/authorization/permissions.decorator.js";
import { Organization } from "../../database/entities/organization.entity.js";
import { TenantTransactionService } from "../../database/tenant-transaction.service.js";
import { AuditService } from "../audit/audit.service.js";

class AiOptInDto { @IsBoolean() aiOptIn!: boolean; }
type AuthRequest = Request & { user: AuthenticatedPrincipal; correlationId?: string };

@ApiTags("organization-settings") @ApiBearerAuth("bearer")
@Controller("organization/settings")
@UseGuards(AuthGuard("jwt"), OrganizationContextGuard, PermissionGuard)
export class OrganizationSettingsController {
  constructor(private readonly transactions: TenantTransactionService, private readonly audit: AuditService) {}

  @Patch("ai-opt-in") @RequirePermissions("organization:manage-ai")
  async setAiOptIn(@Req() request: AuthRequest, @Body() body: AiOptInDto) {
    const organizationId = request.user.organizationId;
    return this.transactions.run(organizationId, async (manager) => {
      const organization = await manager.findOne(Organization, { where: { id: organizationId } });
      if (!organization) throw new NotFoundException("Organization not found");
      organization.aiOptIn = body.aiOptIn;
      await manager.save(organization);
      await this.audit.append(manager, {
        organizationId, actorId: request.user.userId, actorType: "human", action: "organization.ai_opt_in_changed",
        resourceType: "organization", resourceId: organizationId, result: "updated", correlationId: request.correlationId ?? "00000000-0000-4000-8000-000000000000",
        metadata: { aiOptIn: body.aiOptIn },
      });
      return { aiOptIn: organization.aiOptIn };
    });
  }
}
