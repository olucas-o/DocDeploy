import { Body, Controller, Param, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "@nestjs/passport";
import type { Request } from "express";

import type { AuthenticatedPrincipal } from "../../common/auth/jwt.strategy.js";
import { OrganizationContextGuard } from "../../common/authorization/organization-context.guard.js";
import { PermissionGuard } from "../../common/authorization/permission.guard.js";
import { RequirePermissions } from "../../common/authorization/permissions.decorator.js";
import { ConfirmUploadDto } from "./dto/confirm-upload.dto.js";
import { DocumentVersionsService } from "./document-versions.service.js";

@ApiTags("document-versions") @ApiBearerAuth("bearer")
@Controller("document-versions")
@UseGuards(AuthGuard("jwt"), OrganizationContextGuard, PermissionGuard)
export class DocumentVersionsController {
  constructor(private readonly versions: DocumentVersionsService) {}
  @Post(":id/confirm-upload") @RequirePermissions("documents:create")
  confirm(@Req() request: Request & { user: AuthenticatedPrincipal; correlationId?: string }, @Param("id") id: string, @Body() body: ConfirmUploadDto) {
    return this.versions.confirm(request.user.organizationId, request.user.userId, request.correlationId ?? "00000000-0000-4000-8000-000000000000", id, body);
  }
}
