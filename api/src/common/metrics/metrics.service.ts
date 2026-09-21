import { Injectable } from "@nestjs/common";
import { Counter, Histogram, Registry, collectDefaultMetrics } from "prom-client";

@Injectable()
export class MetricsService {
  readonly registry = new Registry();
  readonly processingFailures = new Counter({ name: "docdeploy_processing_failures_total", help: "Sanitized processing failures", labelNames: ["stage"], registers: [this.registry] });
  readonly processingDuration = new Histogram({ name: "docdeploy_processing_duration_seconds", help: "Processing stage duration", labelNames: ["stage"], registers: [this.registry] });
  constructor() { collectDefaultMetrics({ register: this.registry, prefix: "docdeploy_api_" }); }
  render(): Promise<string> { return this.registry.metrics(); }
}
