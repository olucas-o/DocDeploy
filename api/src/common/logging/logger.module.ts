import { Module } from "@nestjs/common";
import { LoggerModule as PinoLoggerModule } from "nestjs-pino";

@Module({
  imports: [PinoLoggerModule.forRoot({ pinoHttp: { redact: ["req.headers.authorization", "req.headers.cookie", "res.headers.set-cookie"], level: process.env.LOG_LEVEL ?? "info" } })],
  exports: [PinoLoggerModule],
})
export class LoggerModule {}
