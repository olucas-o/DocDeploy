import { Controller, Get, Header } from "@nestjs/common";

import { MetricsService } from "../../common/metrics/metrics.service.js";

@Controller("health")
export class HealthController {
  constructor(private readonly metrics: MetricsService) {}
  @Get()
  getHealth(): { service: string; status: string } {
    return { service: "api", status: "ok" };
  }

  @Get("metrics")
  @Header("content-type", "text/plain; version=0.0.4")
  getMetrics(): Promise<string> {
    return this.metrics.render();
  }
}
