import { describe, expect, test } from "bun:test";
import { getClientIp } from "../controllers/clientIp";

describe("getClientIp", () => {
	test("ignores forwarded headers by default", () => {
		const request = new Request("http://localhost", {
			headers: { "x-forwarded-for": "203.0.113.10" },
		});
		expect(
			getClientIp(request, null, {
				trustProxyHeaders: false,
				trustedProxyCidrs: [],
			}),
		).toBe("127.0.0.1");
	});

	test("uses the first forwarded address for a trusted proxy", () => {
		const request = new Request("http://localhost", {
			headers: { "x-forwarded-for": "203.0.113.10, 10.0.0.2" },
		});
		expect(
			getClientIp(request, null, {
				trustProxyHeaders: true,
				trustedProxyCidrs: ["127.0.0.0/8"],
			}),
		).toBe("203.0.113.10");
	});

	test("ignores proxy headers from untrusted peers and invalid addresses", () => {
		const untrusted = new Request("http://localhost", {
			headers: { "x-forwarded-for": "203.0.113.10" },
		});
		expect(
			getClientIp(untrusted, null, {
				trustProxyHeaders: true,
				trustedProxyCidrs: ["10.0.0.0/8"],
			}),
		).toBe("127.0.0.1");

		const invalid = new Request("http://localhost", {
			headers: { "cf-connecting-ip": "not-an-ip" },
		});
		expect(
			getClientIp(invalid, null, {
				trustProxyHeaders: true,
				trustedProxyCidrs: ["127.0.0.0/8"],
			}),
		).toBe("127.0.0.1");
	});
});
