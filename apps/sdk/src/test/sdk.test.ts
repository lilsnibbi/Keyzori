import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { EventBroker } from "../core/EventBroker";
import { NetworkClient } from "../core/NetworkClient";
import * as publicApi from "../index";
import { LicenseClient } from "../index";

describe("SDK Client Core", () => {
	let originalFetch: typeof global.fetch;
	let originalConsoleError: typeof console.error;

	beforeEach(() => {
		originalFetch = global.fetch;
		originalConsoleError = console.error;
		console.error = mock(() => {}) as unknown as typeof console.error;
	});

	afterEach(() => {
		global.fetch = originalFetch;
		console.error = originalConsoleError;
	});

	it("exports only LicenseClient at runtime", () => {
		expect(Object.keys(publicApi)).toEqual(["LicenseClient"]);
	});

	it("initializes successfully and emits ready", async () => {
		global.fetch = mock(async (url: string | URL | Request) => {
			if (url.toString().includes("/v1/handshake")) {
				return new Response(
					JSON.stringify({
						success: true,
						type: "PERPETUAL",
						customFields: { tier: "premium" },
						sessionToken: "11111111-1111-4111-8111-111111111111",
					}),
					{ status: 200 },
				);
			}
			return new Response("Not Found", { status: 404 });
		}) as unknown as typeof fetch;

		const client = new LicenseClient({
			apiKey: "test_key",
			serverUrl: "http://localhost:3000",
		});

		let readyCalled = false;
		client.events.on("ready", (fields) => {
			expect(fields).toEqual({ tier: "premium" });
			readyCalled = true;
		});

		const data = await client.initialize();
		const secondData = await client.initialize();
		expect(data).toEqual({ tier: "premium" });
		expect(secondData).toEqual(data);
		expect(global.fetch).toHaveBeenCalled();
		expect(global.fetch).toHaveBeenCalledTimes(1);
		expect(readyCalled).toBe(true);

		await client.destroy();
	});

	it("rejects cleartext remote URLs in the internal network client", () => {
		expect(
			() => new NetworkClient("http://licenses.example.com", "test_key"),
		).toThrow("serverUrl must use HTTPS");
		expect(
			() => new NetworkClient("https://licenses.example.com", "test_key"),
		).not.toThrow();
		expect(
			() => new NetworkClient("http://localhost:3000", "test_key"),
		).not.toThrow();
	});

	it("rejects invalid configuration before making requests", () => {
		expect(
			() =>
				new LicenseClient({
					apiKey: "",
					serverUrl: "not-a-url",
				}),
		).toThrow("apiKey is required");
		expect(
			() =>
				new LicenseClient({
					apiKey: "key",
					serverUrl: "ftp://example.com",
				}),
		).toThrow("serverUrl must use HTTPS");
		expect(
			() =>
				new LicenseClient({
					apiKey: "key",
					serverUrl: "http://licenses.example.com",
				}),
		).toThrow("serverUrl must use HTTPS");
	});

	it("bounds response bodies before parsing them", async () => {
		global.fetch = mock(
			async () =>
				new Response(
					JSON.stringify({
						success: true,
						type: "PERPETUAL",
						customFields: { payload: "x".repeat(262_144) },
						sessionToken: "11111111-1111-4111-8111-111111111111",
					}),
					{ status: 200 },
				),
		) as unknown as typeof fetch;
		const client = new LicenseClient({
			apiKey: "test-key",
			serverUrl: "https://licenses.example.com",
		});
		expect(client.initialize()).rejects.toThrow(
			"response exceeded the safety limit",
		);
	});

	it("contains listener failures so lifecycle enforcement continues", async () => {
		let handshakeCount = 0;
		let logoutCount = 0;
		global.fetch = mock(async (url: string | URL | Request) => {
			if (url.toString().includes("/v1/logout")) {
				logoutCount++;
				return new Response(JSON.stringify({ success: true }));
			}
			handshakeCount++;
			if (handshakeCount === 1) {
				return new Response(
					JSON.stringify({
						success: true,
						type: "PERPETUAL",
						customFields: {},
						sessionToken: "11111111-1111-4111-8111-111111111111",
					}),
				);
			}
			return new Response(JSON.stringify({ error: "temporary" }), {
				status: 500,
			});
		}) as unknown as typeof fetch;

		const client = new LicenseClient({
			apiKey: "test-key",
			serverUrl: "https://licenses.example.com",
			heartbeatIntervalMs: 1,
			maxRetries: 1,
		});
		client.events.on("heartbeat:failed", () => {
			throw new Error("consumer failure");
		});
		client.events.on("network:offline", () => {
			throw new Error("consumer failure");
		});
		await client.initialize();
		await Bun.sleep(20);
		expect(logoutCount).toBe(1);
	});

	it("preserves once semantics while containing listener exceptions", () => {
		const listenerErrors: unknown[] = [];
		const broker = new EventBroker((error) => listenerErrors.push(error));
		let calls = 0;
		broker.once("heartbeat:success", () => {
			calls++;
			throw new Error("listener failed");
		});
		broker.emit("heartbeat:success");
		broker.emit("heartbeat:success");
		expect(calls).toBe(1);
		expect(listenerErrors).toHaveLength(1);

		let removedCalls = 0;
		const removedListener = () => {
			removedCalls++;
		};
		broker.on("heartbeat:success", removedListener);
		broker.removeListener("heartbeat:success", removedListener);
		broker.emit("heartbeat:success");
		expect(removedCalls).toBe(0);
	});

	it("rejects malformed success responses", async () => {
		global.fetch = mock(
			async () =>
				new Response(JSON.stringify({ success: true }), { status: 200 }),
		) as unknown as typeof fetch;
		const client = new LicenseClient({
			apiKey: "test-key",
			serverUrl: "http://localhost:3000",
		});
		expect(client.initialize()).rejects.toThrow(
			"License server returned an invalid handshake response",
		);
	});

	it("cannot be reactivated by an initialization response after destroy", async () => {
		let resolveHandshake: ((response: Response) => void) | undefined;
		global.fetch = mock(async (url: string | URL | Request) => {
			if (url.toString().includes("/v1/logout")) {
				return new Response(JSON.stringify({ success: true }));
			}
			return await new Promise<Response>((resolve) => {
				resolveHandshake = resolve;
			});
		}) as unknown as typeof fetch;

		const client = new LicenseClient({
			apiKey: "test-key",
			serverUrl: "http://localhost:3000",
		});
		const initialization = client.initialize();
		await client.destroy();
		if (!resolveHandshake) throw new Error("Handshake did not start");
		resolveHandshake(
			new Response(
				JSON.stringify({
					success: true,
					type: "PERPETUAL",
					customFields: {},
					sessionToken: "11111111-1111-4111-8111-111111111111",
				}),
			),
		);
		expect(initialization).rejects.toThrow(
			"LicenseClient was destroyed during initialization",
		);
	});

	it("throws error and cleans up on invalid handshake", async () => {
		global.fetch = mock(async () => {
			return new Response(JSON.stringify({ error: "Invalid API key" }), {
				status: 403,
			});
		}) as unknown as typeof fetch;

		const client = new LicenseClient({
			apiKey: "invalid_key",
			serverUrl: "http://localhost:3000",
		});

		try {
			await client.initialize();
			expect(false).toBe(true);
		} catch (err: unknown) {
			const error = err as Error;
			expect(error.message).toContain("License Block: Invalid API key");
		}

		expect(console.error).not.toHaveBeenCalled();
		await client.destroy();
	});
});
