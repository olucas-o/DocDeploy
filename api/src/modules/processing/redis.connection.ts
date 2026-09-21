export interface RedisConnectionOptions { host: string; port: number; password?: string; }

export function redisConnection(): RedisConnectionOptions {
  const url = new URL(process.env.REDIS_URL ?? "redis://127.0.0.1:6379");
  return { host: url.hostname, port: Number(url.port || 6379), ...(url.password ? { password: url.password } : {}) };
}
