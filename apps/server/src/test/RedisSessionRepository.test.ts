import { describe, expect, mock, test } from "bun:test";
import type { RedisClient } from "bun";
import { RedisSessionRepository } from "../infrastructure/repositories/RedisSessionRepository";

describe("RedisSessionRepository", () => {
	const binding = { ip: "203.0.113.10", hwid: "hwid-1" };
	const bindingHash = new Bun.CryptoHasher("sha256")
		.update(`${binding.ip}\0${binding.hwid}`)
		.digest("hex");

	test.each([1, -1] as const)(
		"maps registration result %i",
		async (redisResult) => {
			const send = mock(
				async (_command: string, _args: string[]): Promise<number> =>
					redisResult,
			);
			const repository = new RedisSessionRepository({
				send,
			} as unknown as RedisClient);

			expect(
				await repository.registerSession("key-1", binding, 45, 2),
			).toMatchObject(
				redisResult === 1
					? { status: "registered" }
					: { status: "limit-reached" },
			);
			expect(send).toHaveBeenCalledTimes(1);
			const [command, args] = send.mock.calls[0] ?? [];
			expect(command).toBe("EVAL");
			const sessionToken = args?.[4];
			if (!sessionToken)
				throw new Error("Session token was not passed to Redis");
			expect(args?.slice(1)).toEqual([
				"2",
				"sessions:key-1",
				`session_ttl:key-1:${sessionToken}`,
				sessionToken,
				"45",
				"2",
				"session_ttl:key-1:",
				bindingHash,
			]);
		},
	);

	test.each([
		[1, true],
		[0, false],
	] as const)("maps refresh result %i", async (redisResult, expected) => {
		const send = mock(
			async (_command: string, _args: string[]): Promise<number> => redisResult,
		);
		const repository = new RedisSessionRepository({
			send,
		} as unknown as RedisClient);
		expect(
			await repository.refreshSession("key-1", "session-token", binding, 45),
		).toBe(expected);
		expect(send.mock.calls[0]?.[1]?.slice(1)).toEqual([
			"2",
			"sessions:key-1",
			"session_ttl:key-1:session-token",
			"session-token",
			"45",
			bindingHash,
		]);
	});

	test.each([
		[1, true],
		[0, false],
	] as const)("maps removal result %i", async (redisResult, expected) => {
		const send = mock(
			async (_command: string, _args: string[]): Promise<number> => redisResult,
		);
		const repository = new RedisSessionRepository({
			send,
		} as unknown as RedisClient);
		expect(
			await repository.removeSession("key-1", "session-token", binding),
		).toBe(expected);
		expect(send.mock.calls[0]?.[1]?.slice(1)).toEqual([
			"2",
			"sessions:key-1",
			"session_ttl:key-1:session-token",
			"session-token",
			bindingHash,
		]);
	});

	test("rejects an unexpected Redis result", async () => {
		const repository = new RedisSessionRepository({
			send: mock(async () => "unexpected"),
		} as unknown as RedisClient);

		expect(repository.registerSession("key-1", binding, 45, 1)).rejects.toThrow(
			"invalid session registration result",
		);
	});

	test("rejects an unexpected refresh result", async () => {
		const repository = new RedisSessionRepository({
			send: mock(async () => "unexpected"),
		} as unknown as RedisClient);
		expect(
			repository.refreshSession("key-1", "session-token", binding, 45),
		).rejects.toThrow("invalid session refresh result");
	});

	test("rejects an unexpected removal result", async () => {
		const repository = new RedisSessionRepository({
			send: mock(async () => "unexpected"),
		} as unknown as RedisClient);
		expect(
			repository.removeSession("key-1", "session-token", binding),
		).rejects.toThrow("invalid session removal result");
	});
});
