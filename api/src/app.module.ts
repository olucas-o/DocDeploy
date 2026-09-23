import { MiddlewareConsumer, Module, type NestModule } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";

import { LoggerModule } from "./common/logging/logger.module.js";
import { CorrelationMiddleware } from "./common/logging/correlation.middleware.js";
import { MetricsService } from "./common/metrics/metrics.service.js";
import { JwtStrategy, jwtSecret } from "./common/auth/jwt.strategy.js";
import { DatabaseModule } from "./database/database.module.js";
import { AuthController } from "./modules/auth/auth.controller.js";
import { AuthService } from "./modules/auth/auth.service.js";
import { DocumentsModule } from "./modules/documents/documents.module.js";
import { ProcessingModule } from "./modules/processing/processing.module.js";
import { ReviewsModule } from "./modules/reviews/reviews.module.js";
import { HealthController } from "./modules/health/health.controller.js";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LoggerModule,
    PassportModule,
    JwtModule.register({ global: true, secret: jwtSecret() }),
    ...(process.env.DATABASE_URL ? [DatabaseModule, DocumentsModule, ProcessingModule, ReviewsModule] : []),
  ],
  controllers: [HealthController, ...(process.env.DATABASE_URL ? [AuthController] : [])],
  providers: [MetricsService, JwtStrategy, ...(process.env.DATABASE_URL ? [AuthService] : [])],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void { consumer.apply(CorrelationMiddleware).forRoutes("*"); }
}
