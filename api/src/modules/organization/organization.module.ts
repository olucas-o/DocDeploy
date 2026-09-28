import { Module } from "@nestjs/common";

import { DatabaseModule } from "../../database/database.module.js";
import { AuditService } from "../audit/audit.service.js";
import { OrganizationSettingsController } from "./organization-settings.controller.js";

@Module({ imports: [DatabaseModule], controllers: [OrganizationSettingsController], providers: [AuditService] })
export class OrganizationModule {}
