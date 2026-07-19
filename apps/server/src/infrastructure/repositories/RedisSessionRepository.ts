import type { RedisClient } from "bun";
import type {
	ISessionRepository,
	SessionBinding,
	SessionRegistrationResult,
} from "../../domain/repositories/ISessionRepository";

const REGISTER_SESSION_SCRIPT = `
local members = redis.call("SMEMBERS", KEYS[1])
for _, member in ipairs(members) do
  if redis.call("EXISTS", ARGV[4] .. member) == 0 then
    redis.call("SREM", KEYS[1], member)
  end
end

local maximum = tonumber(ARGV[3])
if maximum > 0 and redis.call("SCARD", KEYS[1]) >= maximum then
  return -1
end

redis.call("SET", KEYS[2], ARGV[5], "EX", ARGV[2])
redis.call("SADD", KEYS[1], ARGV[1])
redis.call("EXPIRE", KEYS[1], ARGV[2])
return 1
`;

const REFRESH_SESSION_SCRIPT = `
if redis.call("GET", KEYS[2]) ~= ARGV[3] then
  return 0
end
redis.call("EXPIRE", KEYS[2], ARGV[2])
redis.call("SADD", KEYS[1], ARGV[1])
redis.call("EXPIRE", KEYS[1], ARGV[2])
return 1
`;

const REMOVE_SESSION_SCRIPT = `
if redis.call("GET", KEYS[2]) ~= ARGV[2] then
  return 0
end
redis.call("SREM", KEYS[1], ARGV[1])
redis.call("DEL", KEYS[2])
return 1
`;

export class RedisSessionRepository implements ISessionRepository {
	constructor(private readonly redis: RedisClient) {}

	async registerSession(
		apiKeyId: string,
		binding: SessionBinding,
		ttlSeconds: number,
		maxConcurrent: number,
	): Promise<SessionRegistrationResult> {
		const sessionToken = crypto.randomUUID();
		const sessionKey = `sessions:${apiKeyId}`;
		const ttlKey = this.sessionTtlKey(apiKeyId, sessionToken);
		const ttlPrefix = `session_ttl:${apiKeyId}:`;
		const result: unknown = await this.redis.send("EVAL", [
			REGISTER_SESSION_SCRIPT,
			"2",
			sessionKey,
			ttlKey,
			sessionToken,
			String(ttlSeconds),
			String(maxConcurrent),
			ttlPrefix,
			this.hashBinding(binding),
		]);
		if (result === 1) return { status: "registered", token: sessionToken };
		if (result === -1) return { status: "limit-reached" };
		throw new Error("Redis returned an invalid session registration result.");
	}

	async refreshSession(
		apiKeyId: string,
		sessionToken: string,
		binding: SessionBinding,
		ttlSeconds: number,
	): Promise<boolean> {
		const result: unknown = await this.redis.send("EVAL", [
			REFRESH_SESSION_SCRIPT,
			"2",
			`sessions:${apiKeyId}`,
			this.sessionTtlKey(apiKeyId, sessionToken),
			sessionToken,
			String(ttlSeconds),
			this.hashBinding(binding),
		]);
		if (result === 1) return true;
		if (result === 0) return false;
		throw new Error("Redis returned an invalid session refresh result.");
	}

	async removeSession(
		apiKeyId: string,
		sessionToken: string,
		binding: SessionBinding,
	): Promise<boolean> {
		const result: unknown = await this.redis.send("EVAL", [
			REMOVE_SESSION_SCRIPT,
			"2",
			`sessions:${apiKeyId}`,
			this.sessionTtlKey(apiKeyId, sessionToken),
			sessionToken,
			this.hashBinding(binding),
		]);
		if (result === 1) return true;
		if (result === 0) return false;
		throw new Error("Redis returned an invalid session removal result.");
	}

	private sessionTtlKey(apiKeyId: string, sessionToken: string): string {
		return `session_ttl:${apiKeyId}:${sessionToken}`;
	}

	private hashBinding(binding: SessionBinding): string {
		return new Bun.CryptoHasher("sha256")
			.update(`${binding.ip}\0${binding.hwid}`)
			.digest("hex");
	}
}
