import { Controller, Get, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "@nestjs/passport";
import type { Request } from "express";

import type { AuthenticatedPrincipal } from "../../common/auth/jwt.strategy.js";
import { OrganizationContextGuard } from "../../common/authorization/organization-context.guard.js";
import { PermissionGuard } from "../../common/authorization/permission.guard.js";
import { RequirePermissions } from "../../common/authorization/permissions.decorator.js";
import { AuditExportService } from "./audit-export.service.js";
import { AuditQueryService, type AuditFilters } from "./audit-query.service.js";

type AuthRequest = Request & { user: AuthenticatedPrincipal };

@ApiTags("audit") @ApiBearerAuth("bearer")
@Controller("audit-events")
@UseGuards(AuthGuard("jwt"), OrganizationContextGuard, PermissionGuard)
export class AuditController {
  constructor(private readonly queries: AuditQueryService, private readonly exports: AuditExportService) {}
  @Get() @RequirePermissions("audit:read")
  list(@Req() request: AuthRequest, @Query() filters: AuditFilters) { return this.queries.list(request.user.organizationId, filters); }
  @Get("export") @RequirePermissions("audit:export")
  export(@Req() request: AuthRequest, @Query() filters: AuditFilters) { return this.exports.export(request.user.organizationId, filters); }
}
