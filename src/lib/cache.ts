import { createClient } from "redis";

const client = createClient({
  url: process.env.REDIS_URL ?? "redis://localhost:6379",
});

let connected = false;
let unavailable = false;

client.on("error", (err) => {
  if (!connected) unavailable = true;
  console.error("[Redis] connection error:", err.message);
});

async function getClient() {
  if (unavailable) throw new Error("Redis unavailable");
  if (!connected) {
    await client.connect();
    connected = true;
  }
  return client;
}

/**
 * ดึงข้อมูลจาก cache ถ้ามี ไม่งั้น run fn แล้ว cache ผลลัพธ์
 * ถ้า Redis ไม่พร้อม จะ fallback ไปเรียก fn ตรงๆ โดยไม่ error
 */
export async function withCache<T>(
  key: string,
  ttlSeconds: number,
  fn: () => Promise<T>
): Promise<T> {
  try {
    const redis = await getClient();
    const cached = await redis.get(key);
    if (cached !== null) return JSON.parse(cached) as T;
    const result = await fn();
    await redis.setEx(key, ttlSeconds, JSON.stringify(result));
    return result;
  } catch {
    // Redis unavailable — fallback to direct DB query
    return fn();
  }
}

/**
 * ลบ cache keys ที่ match pattern (ใช้ SCAN เพื่อไม่บล็อก Redis)
 * รองรับ wildcard เช่น "strategies:*", "settings:budget-*"
 */
export async function invalidate(pattern: string): Promise<void> {
  try {
    const redis = await getClient();
    let cursor = "0";
    do {
      const reply = await redis.scan(cursor, { MATCH: pattern, COUNT: 100 });
      cursor = reply.cursor;
      if (reply.keys.length) await redis.del(reply.keys);
    } while (cursor !== "0");
  } catch {
    // Redis unavailable — ignore silently
  }
}
