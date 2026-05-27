import { createClient, type RedisClientType } from "redis";

const REDIS_ADDR = process.env.REDIS_ADDR ?? "127.0.0.1:6379";
const REDIS_PASSWORD = (process.env.REDIS_PASSWORD ?? "").trim();
const REDIS_URL = (process.env.REDIS_URL ?? "").trim();

function noAuthUrl(): string {
  return `redis://${REDIS_ADDR}`;
}

function passwordUrl(password: string): string {
  return `redis://:${encodeURIComponent(password)}@${REDIS_ADDR}`;
}

async function connectAndPing(url: string): Promise<RedisClientType> {
  const client = createClient({ url }) as RedisClientType;
  client.on("error", (err) => console.error("Redis error:", err));
  await client.connect();
  await client.ping();
  return client;
}

async function noAuthWorks(): Promise<boolean> {
  const client = createClient({ url: noAuthUrl() }) as RedisClientType;
  try {
    await client.connect();
    await client.ping();
    return true;
  } catch {
    return false;
  } finally {
    if (client.isOpen) {
      await client.quit().catch(() => {});
    }
  }
}

/**
 * Connect to Redis using REDIS_URL or REDIS_ADDR + REDIS_PASSWORD.
 * Probes without AUTH first when a password is configured so local dev
 * (no requirepass) does not hang on bogus AUTH — matches api/.env defaults.
 */
export async function createRedisClient(): Promise<RedisClientType> {
  if (REDIS_URL) {
    return connectAndPing(REDIS_URL);
  }

  if (REDIS_PASSWORD) {
    const openWithoutAuth = await noAuthWorks();
    if (openWithoutAuth) {
      console.warn(
        `[redis] REDIS_PASSWORD is set but ${REDIS_ADDR} accepts unauthenticated connections; using no AUTH`,
      );
      return connectAndPing(noAuthUrl());
    }
    return connectAndPing(passwordUrl(REDIS_PASSWORD));
  }

  return connectAndPing(noAuthUrl());
}
