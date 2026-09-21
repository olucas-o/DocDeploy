import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { entities } from "./data-source.js";
import { TenantTransactionService } from "./tenant-transaction.service.js";

@Module({
  imports: [TypeOrmModule.forRoot({
    type: "postgres",
    ...(process.env.DATABASE_URL
      ? { url: process.env.DATABASE_URL }
      : { host: "127.0.0.1", port: 5432, database: "docdeploy", username: "docdeploy_app", password: "not-configured" }),
    entities,
    synchronize: false,
  })],
  providers: [TenantTransactionService],
  exports: [TenantTransactionService, TypeOrmModule],
})
export class DatabaseModule {}
