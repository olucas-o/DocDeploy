import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import type { Request } from "express";

import type { AuthenticatedPrincipal } from "../auth/jwt.strategy.js";

export function assertTenantMatch(sessionOrganizationId: string, resourceOrganizationId: string): void {
  if (sessionOrganizationId !== resourceOrganizationId) throw new ForbiddenException("Resource is not available");
}

@Injectable()
export class OrganizationContextGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedPrincipal }>();
    return Boolean(request.user?.organizationId);
  }
}
