import { randomUUID } from "node:crypto";

import { Injectable, type NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";

@Injectable()
export class CorrelationMiddleware implements NestMiddleware {
  use(request: Request & { correlationId?: string }, response: Response, next: NextFunction): void {
    const supplied = request.header("x-correlation-id");
    request.correlationId = supplied && /^[0-9a-f-]{36}$/i.test(supplied) ? supplied : randomUUID();
    response.setHeader("x-correlation-id", request.correlationId);
    next();
  }
}
