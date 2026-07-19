import type { RedisClient } from "bun";
import type { Elysia } from "elysia";
import type { ClientIpOptions } from "../controllers/clientIp";
import { getClientIp } from "../controllers/clientIp";

const RATE_LIMIT_SCRIPT = `
redis.call("ZREMRANGEBYSCORE", KEYS[1], 0, ARGV[1])
if redis.call("ZCARD", KEYS[1]) >= tonumber(ARGV[4]) then
  return 0
end
redis.call("ZADD", KEYS[1], ARGV[2], ARGV[3])
redis.call("EXPIRE", KEYS[1], ARGV[5])
return 1
`;

export const rateLimiter =
	(
		redis: RedisClient,
		requestsPerMinute: number = 60,
		clientIpOptions: ClientIpOptions = {
			trustProxyHeaders: false,
			trustedProxyCidrs: [],
		},
	) =>
	(app: Elysia) =>
		app.onBeforeHandle(async ({ request, server, set }) => {
			if (new URL(request.url).pathname === "/ready") return;
			const ip = getClientIp(request, server, clientIpOptions);
			const key = `ratelimit:${ip}`;
			const now = Date.now();
			const windowStart = now - 60000;

			const allowed: unknown = await redis.send("EVAL", [
				RATE_LIMIT_SCRIPT,
				"1",
				key,
				String(windowStart),
				String(now),
				`${now}:${crypto.randomUUID()}`,
				String(requestsPerMinute),
				"60",
			]);
			if (allowed === 0) {
				set.status = 429;
				return { error: "Too Many Requests" };
			}
			if (allowed !== 1)
				throw new Error("Redis returned an invalid rate limit result.");
		});
