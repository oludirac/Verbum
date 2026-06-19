type RateLimitEntry = {
  count: number;
  resetTime: number;
};

const buckets = new Map<string, RateLimitEntry>();

export type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
};

export const getClientKey = (request: Request) => {
  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const cfIp = request.headers.get("cf-connecting-ip");
  return forwarded?.split(",")[0]?.trim() || realIp || cfIp || "unknown";
};

export const checkRateLimit = (
  namespace: string,
  key: string,
  maxRequests: number,
  windowMs: number
): RateLimitResult => {
  const now = Date.now();
  const bucketKey = `${namespace}:${key}`;
  const entry = buckets.get(bucketKey);

  if (!entry || now > entry.resetTime) {
    buckets.set(bucketKey, { count: 1, resetTime: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (entry.count >= maxRequests) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((entry.resetTime - now) / 1000)),
    };
  }

  entry.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
};
