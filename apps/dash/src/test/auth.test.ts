import { describe, expect, test } from "bun:test";
import { SessionManager } from "../auth";
import { loadDashboardConfig } from "../config";
import { createDashboard } from "../index";

const password = "a-secure-dashboard-password";

describe("dashboard configuration", () => {
	test("loads the required server, login, and API credentials", () => {
		const config = loadDashboardConfig({
			KEYZORI_SERVER_URL: "https://licenses.example.com",
			KEYZORI_AUTH_PASS: password,
			KEYZORI_ADMIN_KEY: "a-secure-admin-key-that-is-over-32-characters",
		});
		expect(config.serverUrl.href).toBe("https://licenses.example.com/");
		expect(config.port).toBe(3100);
		expect(config.secureCookies).toBe(true);
	});

	test("rejects insecure remote API URLs and weak secrets", () => {
		expect(() =>
			loadDashboardConfig({
				KEYZORI_SERVER_URL: "http://licenses.example.com",
				KEYZORI_AUTH_PASS: password,
				KEYZORI_ADMIN_KEY: "a-secure-admin-key-that-is-over-32-characters",
			}),
		).toThrow("must use HTTPS");
		expect(() =>
			loadDashboardConfig({
				KEYZORI_SERVER_URL: "https://licenses.example.com",
				KEYZORI_AUTH_PASS: "password",
				KEYZORI_ADMIN_KEY: "a-secure-admin-key-that-is-over-32-characters",
			}),
		).toThrow("KEYZORI_AUTH_PASS");
	});
});

describe("dashboard sessions", () => {
	test("creates server-side sessions and clears them on logout", () => {
		const sessions = new SessionManager(password, 60_000, false);
		const login = sessions.login(password, "127.0.0.1", 1_000);
		expect(login.ok).toBe(true);
		if (!login.ok) throw new Error("Expected login to succeed");
		const cookie = login.cookie.split(";", 1)[0];
		const request = new Request("http://localhost/api/session", {
			headers: { cookie },
		});
		expect(sessions.verify(request, 1_001)).toBe(true);
		expect(sessions.logout(request)).toContain("Max-Age=0");
		expect(sessions.verify(request, 1_002)).toBe(false);
	});

	test("rate limits repeated invalid passwords", () => {
		const sessions = new SessionManager(password, 60_000, false);
		for (let index = 0; index < 5; index += 1) {
			expect(sessions.login("wrong", "client", 1_000).ok).toBe(false);
		}
		const blocked = sessions.login("still-wrong", "client", 1_001);
		expect(blocked.ok).toBe(false);
		if (blocked.ok) throw new Error("Expected login to be rate limited");
		expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
		expect(sessions.login(password, "client", 1_002).ok).toBe(true);
	});
});

describe("dashboard HTTP boundary", () => {
	const app = createDashboard({
		serverUrl: new URL("http://127.0.0.1:39999"),
		authPassword: password,
		adminKey: "a-secure-admin-key-that-is-over-32-characters",
		host: "127.0.0.1",
		port: 3100,
		secureCookies: false,
		sessionTtlMinutes: 60,
		upstreamTimeoutMs: 1_000,
	});

	test("requires same-origin login and an authenticated admin session", async () => {
		const rejected = await app.handle(
			new Request("http://localhost/api/login", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ password }),
			}),
		);
		expect(rejected.status).toBe(403);

		const unauthorized = await app.handle(
			new Request("http://localhost/api/admin/users"),
		);
		expect(unauthorized.status).toBe(401);

		const login = await app.handle(
			new Request("http://localhost/api/login", {
				method: "POST",
				headers: {
					"content-type": "application/json",
					origin: "http://localhost",
				},
				body: JSON.stringify({ password }),
			}),
		);
		expect(login.status).toBe(200);
		const cookie = login.headers.get("set-cookie")?.split(";", 1)[0];
		expect(cookie).toContain("keyzori_session=");

		const session = await app.handle(
			new Request("http://localhost/api/session", {
				headers: { cookie: cookie ?? "" },
			}),
		);
		expect(await session.json()).toMatchObject({ authenticated: true });

		const crossOrigin = await app.handle(
			new Request("http://localhost/api/admin/users", {
				method: "POST",
				headers: {
					cookie: cookie ?? "",
					"content-type": "application/json",
					origin: "https://attacker.example",
				},
				body: JSON.stringify({ name: "Owner", email: "owner@example.com" }),
			}),
		);
		expect(crossOrigin.status).toBe(403);
	});

	test("serves the UI with strict browser security headers", async () => {
		const response = await app.handle(new Request("http://localhost/"));
		expect(response.status).toBe(200);
		expect(response.headers.get("content-security-policy")).toContain(
			"default-src 'self'",
		);
		expect(response.headers.get("x-frame-options")).toBe("DENY");
	});
});
