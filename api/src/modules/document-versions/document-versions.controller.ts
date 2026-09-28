import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "@nestjs/passport";
import type { Request } from "express";

import type { AuthenticatedPrincipal } from "../../common/auth/jwt.strategy.js";
import { OrganizationContextGuard } from "../../common/authorization/organization-context.guard.js";
import { PermissionGuard } from "../../common/authorization/permission.guard.js";
import { RequirePermissions } from "../../common/authorization/permissions.decorator.js";
import { ConfirmUploadDto } from "./dto/confirm-upload.dto.js";
import { CreateDocumentVersionDto } from "./dto/create-document-version.dto.js";
import { DocumentVersionQueryService } from "./document-version-query.service.js";
import { DocumentVersionsService } from "./document-versions.service.js";

const fallbackCorrelation = "00000000-0000-4000-8000-000000000000";

@ApiTags("document-versions") @ApiBearerAuth("bearer")
@Controller()
@UseGuards(AuthGuard("jwt"), OrganizationContextGuard, PermissionGuard)
export class DocumentVersionsController {
  constructor(private readonly versions: DocumentVersionsService, private readonly queries: DocumentVersionQueryService) {}
  @Post("documents/:id/versions") @RequirePermissions("documents:create")
  create(@Req() request: Request & { user: AuthenticatedPrincipal; correlationId?: string }, @Param("id") id: string, @Body() body: CreateDocumentVersionDto) {
    return this.versions.create(request.user.organizationId, request.user.userId, request.correlationId ?? fallbackCorrelation, id, body);
  }
  @Get("documents/:id/versions") @RequirePermissions("documents:read")
  list(@Req() request: Request & { user: AuthenticatedPrincipal }, @Param("id") id: string) { return this.queries.list(request.user.organizationId, id); }
  @Get("document-versions/:id") @RequirePermissions("documents:read")
  findOne(@Req() request: Request & { user: AuthenticatedPrincipal }, @Param("id") id: string) { return this.queries.findOne(request.user.organizationId, id); }
  @Post("document-versions/:id/confirm-upload") @RequirePermissions("documents:create")
  confirm(@Req() request: Request & { user: AuthenticatedPrincipal; correlationId?: string }, @Param("id") id: string, @Body() body: ConfirmUploadDto) {
    return this.versions.confirm(request.user.organizationId, request.user.userId, request.correlationId ?? "00000000-0000-4000-8000-000000000000", id, body);
  }
}
