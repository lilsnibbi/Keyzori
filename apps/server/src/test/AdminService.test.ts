import { describe, expect, test } from "bun:test";
import { AdminService } from "../application/services/AdminService";
import { NotFoundError } from "../domain/errors";
import type { ApiKey, User } from "../domain/entities";
import type { IKeyRepository } from "../domain/repositories/IKeyRepository";
import type { IUserRepository } from "../domain/repositories/IUserRepository";

const keyFixture: ApiKey = {
	id: "1",
	key: "sk_test",
	userId: "u1",
	type: "PERPETUAL",
	limitIp: 0,
	limitHwid: 0,
	limitConcurrent: 0,
	limitUsage: 0,
	trialDurationMin: 0,
	firstActivatedAt: null,
	customFields: {},
	expiresAt: null,
	revoked: false,
	createdAt: new Date(0),
};

const userFixture: User = {
	id: "u1",
	email: "owner@example.com",
	name: "Owner",
	createdAt: new Date(0),
};

const keyRepo: IKeyRepository = {
	create: async (data) => ({ ...keyFixture, ...data }),
	findById: async (id) => (id === "1" ? keyFixture : null),
	findAll: async () => [],
	update: async (id, data) => ({ ...keyFixture, id, ...data }),
	delete: async () => {},
	findByKeyWithWhitelists: async () => null,
};

const userRepo: IUserRepository = {
	create: async (email, name) => ({ ...userFixture, email, name }),
	findById: async (id) => (id === userFixture.id ? userFixture : null),
	findAll: async () => [userFixture],
};

describe("AdminService", () => {
	const service = new AdminService(keyRepo, userRepo);

	test("creates a user", async () => {
		const user = await service.createUser(" NEW@EXAMPLE.COM ", " New Owner ");
		expect(user.email).toBe("new@example.com");
		expect(user.name).toBe("New Owner");
	});

	test("lists users and keys through repository boundaries", async () => {
		expect(await service.listUsers()).toEqual([userFixture]);
		expect(await service.listKeys()).toEqual([]);
	});

	test("rejects a blank normalized user name", async () => {
		expect(service.createUser("new@example.com", "   ")).rejects.toThrow(
			"User name is required",
		);
	});

	test("requires an existing user when creating a key", async () => {
		expect(
			service.createKey({ userId: "missing", type: "PERPETUAL" }),
		).rejects.toThrow("User not found");
	});

	test("rejects invalid numeric limits and expiry dates", async () => {
		expect(
			service.createKey({
				userId: "u1",
				type: "PERPETUAL",
				limitIp: 1.5,
			}),
		).rejects.toThrow("non-negative integers");
		expect(
			service.createKey({
				userId: "u1",
				type: "SUBSCRIPTION",
				expiresAt: "not-a-date",
			}),
		).rejects.toThrow("valid future date");
		expect(
			service.createKey({
				userId: "u1",
				type: "SUBSCRIPTION",
				expiresAt: "2000-01-01T00:00:00.000Z",
			}),
		).rejects.toThrow("valid future date");
	});

	test("requires a positive balance for USAGE keys", async () => {
		expect(
			service.createKey({ userId: "u1", type: "USAGE", limitUsage: 0 }),
		).rejects.toThrow("USAGE keys require limitUsage greater than zero");
	});

	test("requires an expiry for SUBSCRIPTION keys", async () => {
		expect(
			service.createKey({ userId: "u1", type: "SUBSCRIPTION" }),
		).rejects.toThrow("SUBSCRIPTION keys require expiresAt");
	});

	test("rejects ignored expiry values on other key types", async () => {
		expect(
			service.createKey({
				userId: "u1",
				type: "PERPETUAL",
				expiresAt: "2099-01-01T00:00:00.000Z",
			}),
		).rejects.toThrow("expiresAt is only valid for SUBSCRIPTION keys");
	});

	test("creates a valid key with normalized defaults", async () => {
		const key = await service.createKey({ userId: "u1", type: "PERPETUAL" });
		expect(key.key).toStartWith("sk_");
		expect(key.limitIp).toBe(0);
		expect(key.customFields).toEqual({});
	});

	test("revokeKey throws NotFoundError if key does not exist", async () => {
		expect(service.revokeKey("2")).rejects.toThrow(NotFoundError);
	});

	test("revokeKey sets revoked to true", async () => {
		const key = await service.revokeKey("1");
		expect(key.revoked).toBe(true);
	});
});
