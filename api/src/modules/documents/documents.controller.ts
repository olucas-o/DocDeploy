import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "@nestjs/passport";
import type { Request } from "express";

import type { AuthenticatedPrincipal } from "../../common/auth/jwt.strategy.js";
import { OrganizationContextGuard } from "../../common/authorization/organization-context.guard.js";
import { PermissionGuard } from "../../common/authorization/permission.guard.js";
import { RequirePermissions } from "../../common/authorization/permissions.decorator.js";
import { CreateDocumentDto } from "./dto/create-document.dto.js";
import { DocumentsService, type DocumentSearchFilters } from "./documents.service.js";

type AuthRequest = Request & { user: AuthenticatedPrincipal; correlationId?: string };

@ApiTags("documents") @ApiBearerAuth("bearer")
@Controller("documents")
@UseGuards(AuthGuard("jwt"), OrganizationContextGuard, PermissionGuard)
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}
  @Post() @RequirePermissions("documents:create")
  create(@Req() request: AuthRequest, @Body() body: CreateDocumentDto) { return this.documents.create(request.user.organizationId, request.user.userId, request.correlationId ?? randomCorrelation(), body); }
  @Get() @RequirePermissions("documents:read")
  list(@Req() request: AuthRequest, @Query() query: DocumentSearchFilters) { return this.documents.list(request.user.organizationId, query); }
  @Get(":id") @RequirePermissions("documents:read")
  findOne(@Req() request: AuthRequest, @Param("id") id: string) { return this.documents.findOne(request.user.organizationId, id); }
}

function randomCorrelation(): string { return "00000000-0000-4000-8000-000000000000"; }
