import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { AuditEvent } from "../../database/entities/audit-event.entity.js";
import { DatabaseModule } from "../../database/database.module.js";
import { AuditController } from "./audit.controller.js";
import { AuditExportService } from "./audit-export.service.js";
import { AuditQueryService } from "./audit-query.service.js";

@Module({ imports: [DatabaseModule, TypeOrmModule.forFeature([AuditEvent])], controllers: [AuditController], providers: [AuditQueryService, AuditExportService] })
export class AuditModule {}
