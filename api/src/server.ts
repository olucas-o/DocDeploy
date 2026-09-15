import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { config } from "dotenv";
import Fastify from "fastify";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

config({
  path: resolve(dirname(fileURLToPath(import.meta.url)), "../../.env"),
});

const configuration = z.object({
  CORS_ORIGIN: z.string().trim().min(1).optional(),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
});

const environment = configuration.parse(process.env);
const app = Fastify({ logger: true });

await app.register(cors, {
  origin: environment.CORS_ORIGIN || false,
});
await app.register(multipart, {
  limits: {
    files: 1,
    fileSize: 10 * 1024 * 1024,
  },
});

app.get("/health", async () => ({
  service: "api",
  status: "ok",
}));

const shutdown = async (signal: string) => {
  app.log.info({ signal }, "shutting down");
  await app.close();
};

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

try {
  await app.listen({ host: "0.0.0.0", port: environment.PORT });
} catch (error) {
  app.log.error(error, "unable to start API");
  process.exitCode = 1;
}
