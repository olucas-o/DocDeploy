import { SetMetadata } from "@nestjs/common";

export const PERMISSIONS_KEY = "docdeploy.permissions";
export const RequirePermissions = (...permissions: string[]) => SetMetadata(PERMISSIONS_KEY, permissions);
