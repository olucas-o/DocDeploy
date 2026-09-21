import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from "@nestjs/common";
import type { Request, Response } from "express";

@Catch()
export class SanitizedHttpExceptionFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();
    const request = http.getRequest<Request & { correlationId?: string }>();
    const status = error instanceof HttpException ? error.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    response.status(status).json({
      code: error instanceof HttpException ? `HTTP_${status}` : "INTERNAL_ERROR",
      message: status >= 500 ? "Unexpected server error" : "Request could not be completed",
      correlationId: request.correlationId ?? "unavailable",
    });
  }
}
