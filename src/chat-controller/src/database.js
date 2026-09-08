import Redis from "ioredis";

const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";

const redis = new Redis(redisUrl, {
  lazyConnect: true,
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => (times > 5 ? null : Math.min(times * 500, 2000)),
});

redis.on("error", (error) => {
  console.error("[redis] error:", error.message);
});

redis.on("connect", () => {
  console.log("[redis] conectado");
});

export default redis;