import { describe, expect, mock, test } from "bun:test";
import Elysia, { type Context } from "elysia";
import type { AdminService } from "../application/services/AdminService";
import type { HandshakeService } from "../application/services/HandshakeService";
import { adminPlugin, createAdminAuthMiddleware } from "../controllers/admin";
import { handshakePlugin } from "../controllers/handshake";
import { NotFoundError } from "../domain/errors";

const createdAt = new Date("2026-01-01T00:00:00.000Z");
const user = {
	id: "user-1",
	email: "owner@example.com",
	name: "Owner",
	createdAt,
};
const key = {
	id: "key-1",
	key: "sk_example",
	userId: user.id,
	type: "PERPETUAL" as const,
	limitIp: 0,
	limitHwid: 0,
	limitConcurrent: 0,
	limitUsage: 0,
	trialDurationMin: 0,
	firstActivatedAt: null,
	customFields: {},
	expiresAt: null,
	revoked: false,
	createdAt,
};

function adminRequest(path: string, init?: RequestInit) {
	return new Request(`http://localhost${path}`, {
		...init,
		headers: {
			"content-type": "application/json",
			"x-admin-key": "admin-secret",
			...init?.headers,
		},
	});
}

describe("admin controller", () => {
	test("accepts any configured admin key using the default environment", () => {
		const previousPrimary = Bun.env.ADMIN_API_KEY;
		const previousAdditional = Bun.env.ADMIN_API_KEYS;
		try {
			Bun.env.ADMIN_API_KEY = "primary-secret";
			Bun.env.ADMIN_API_KEYS = " secondary-secret, tertiary-secret ";
			const middleware = createAdminAuthMiddleware();
			const set = {} as Context["set"];
			const result = middleware({
				request: new Request("http://localhost/admin/keys", {
					headers: { "x-admin-key": "secondary-secret" },
				}),
				set,
			} as Context);
			expect(result).toBeUndefined();
			expect(set.status).toBeUndefined();
		} finally {
			if (previousPrimary === undefined) delete Bun.env.ADMIN_API_KEY;
			else Bun.env.ADMIN_API_KEY = previousPrimary;
			if (previousAdditional === undefined) delete Bun.env.ADMIN_API_KEYS;
			else Bun.env.ADMIN_API_KEYS = previousAdditional;
		}
	});

	test("routes successful user and key operations", async () => {
		const service = {
			createUser: mock(async () => user),
			listUsers: mock(async () => [user]),
			createKey: mock(async () => key),
			listKeys: mock(async () => [key]),
			revokeKey: mock(async () => ({ ...key, revoked: true })),
		} as unknown as AdminService;
		const app = new Elysia().use(adminPlugin(service, ["admin-secret"]));

		const createUserResponse = await app.handle(
			adminRequest("/admin/users", {
				method: "POST",
				body: JSON.stringify({ email: user.email, name: user.name }),
			}),
		);
		expect(createUserResponse.status).toBe(201);
		expect(await createUserResponse.json()).toMatchObject({ id: user.id });

		const listUsersResponse = await app.handle(adminRequest("/admin/users"));
		expect(listUsersResponse.status).toBe(200);
		expect(await listUsersResponse.json()).toHaveLength(1);

		const createKeyResponse = await app.handle(
			adminRequest("/admin/keys", {
				method: "POST",
				body: JSON.stringify({ userId: user.id, type: "PERPETUAL" }),
			}),
		);
		expect(createKeyResponse.status).toBe(201);
		expect(await createKeyResponse.json()).toMatchObject({ id: key.id });

		const listKeysResponse = await app.handle(adminRequest("/admin/keys"));
		expect(listKeysResponse.status).toBe(200);
		expect(await listKeysResponse.json()).toHaveLength(1);

		const revokeResponse = await app.handle(
			adminRequest("/admin/keys/key-1", { method: "PATCH" }),
		);
		expect(revokeResponse.status).toBe(200);
		expect(await revokeResponse.json()).toMatchObject({ revoked: true });
	});

	test("maps domain and validation errors to safe responses", async () => {
		const service = {
			createUser: mock(async () => user),
			listUsers: mock(async () => [user]),
			createKey: mock(async () => key),
			listKeys: mock(async () => [key]),
			revokeKey: mock(async () => {
				throw new NotFoundError("ApiKey");
			}),
		} as unknown as AdminService;
		const app = new Elysia().use(adminPlugin(service, ["admin-secret"]));

		const missing = await app.handle(
			adminRequest("/admin/keys/missing", { method: "PATCH" }),
		);
		expect(missing.status).toBe(404);
		expect(await missing.json()).toEqual({ error: "ApiKey not found" });

		const invalid = await app.handle(
			adminRequest("/admin/users", {
				method: "POST",
				body: JSON.stringify({ email: "not-an-email", name: "Owner" }),
			}),
		);
		expect(invalid.status).toBe(400);
		expect(await invalid.json()).toHaveProperty("error");
	});
});

describe("handshake controller", () => {
	test("maps domain failures from handshake operations", async () => {
		const service = {
			processHandshake: mock(async () => {
				throw new NotFoundError("ApiKey");
			}),
			logout: mock(async () => ({ success: true as const })),
		} as unknown as HandshakeService;
		const app = new Elysia().use(handshakePlugin(service));
		const response = await app.handle(
			new Request("http://localhost/v1/handshake", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ apiKey: "sk_example", hwid: "hwid-1" }),
			}),
		);

		expect(response.status).toBe(404);
		expect(await response.json()).toEqual({ error: "ApiKey not found" });
	});
});
