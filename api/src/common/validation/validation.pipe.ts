import { BadRequestException, Injectable, ValidationPipe } from "@nestjs/common";

@Injectable()
export class AllowlistValidationPipe extends ValidationPipe {
  constructor() {
    super({
      forbidNonWhitelisted: true,
      transform: true,
      whitelist: true,
      exceptionFactory: () => new BadRequestException({ code: "VALIDATION_FAILED", message: "Request validation failed" }),
    });
  }
}
