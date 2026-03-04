import IORedis from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

export const redis = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
});

export const bullmqConnection = {
  url: redisUrl,
};

redis.on('error', (error) => {
  console.error('[redis] connection error', error);
});

export async function ensureRedisAvailable(): Promise<void> {
  await redis.ping();
}
