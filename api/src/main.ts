import "reflect-metadata";

import cookieParser from "cookie-parser";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import helmet from "helmet";

import { AppModule } from "./app.module.js";
import { configureOpenApi } from "./openapi/openapi.config.js";
import { AllowlistValidationPipe } from "./common/validation/validation.pipe.js";
import { SanitizedHttpExceptionFilter } from "./common/errors/http-exception.filter.js";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({ credentials: true, origin: process.env.CORS_ORIGIN || false });
  app.useGlobalPipes(new AllowlistValidationPipe());
  app.useGlobalFilters(new SanitizedHttpExceptionFilter());
  app.setGlobalPrefix("api/v1");
  configureOpenApi(app);
  app.enableShutdownHooks();
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, "0.0.0.0");
  Logger.log(`DocDeploy API listening on ${port}`, "Bootstrap");
}

void bootstrap();
