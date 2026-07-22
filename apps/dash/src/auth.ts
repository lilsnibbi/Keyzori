import { timingSafeEqual } from "node:crypto";

interface Session {
	expiresAt: number;
}

interface FailedAttempts {
	count: number;
	windowEndsAt: number;
}

const LOGIN_WINDOW_MS = 15 * 60_000;
const MAX_LOGIN_FAILURES = 5;
const MAX_SESSIONS = 256;

function digest(value: string): Uint8Array {
	return new Bun.CryptoHasher("sha256").update(value).digest();
}

function digestHex(value: string): string {
	return new Bun.CryptoHasher("sha256").update(value).digest("hex");
}

function randomToken(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(32));
	return Buffer.from(bytes).toString("base64url");
}

function cookieValue(request: Request, name: string): string | null {
	const header = request.headers.get("cookie");
	if (!header) return null;
	for (const part of header.split(";")) {
		const separator = part.indexOf("=");
		if (separator === -1) continue;
		if (part.slice(0, separator).trim() === name) {
			return part.slice(separator + 1).trim() || null;
		}
	}
	return null;
}

export type LoginResult =
	| { ok: true; cookie: string }
	| { ok: false; retryAfterSeconds?: number };

export class SessionManager {
	private readonly passwordDigest: Uint8Array;
	private readonly cookieName: string;
	private readonly sessions = new Map<string, Session>();
	private readonly failures = new Map<string, FailedAttempts>();

	constructor(
		password: string,
		private readonly ttlMs: number,
		private readonly secureCookies: boolean,
	) {
		this.passwordDigest = digest(password);
		this.cookieName = secureCookies
			? "__Host-keyzori_session"
			: "keyzori_session";
	}

	login(password: string, clientId: string, now = Date.now()): LoginResult {
		this.prune(now);
		const attempt = this.failures.get(clientId);
		const blocked = Boolean(
			attempt &&
				attempt.windowEndsAt > now &&
				attempt.count >= MAX_LOGIN_FAILURES,
		);
		const supplied = digest(password);
		const valid = timingSafeEqual(this.passwordDigest, supplied);

		if (valid) {
			this.failures.delete(clientId);
			while (this.sessions.size >= MAX_SESSIONS) {
				const oldest = this.sessions.keys().next().value;
				if (!oldest) break;
				this.sessions.delete(oldest);
			}
			const token = randomToken();
			this.sessions.set(digestHex(token), { expiresAt: now + this.ttlMs });
			return { ok: true, cookie: this.serializeCookie(token, this.ttlMs) };
		}
		if (blocked) {
			return {
				ok: false,
				retryAfterSeconds: Math.max(
					1,
					Math.ceil(((attempt?.windowEndsAt ?? now) - now) / 1_000),
				),
			};
		}
		const current =
			attempt && attempt.windowEndsAt > now
				? attempt
				: { count: 0, windowEndsAt: now + LOGIN_WINDOW_MS };
		current.count += 1;
		this.failures.set(clientId, current);
		return { ok: false };
	}

	verify(request: Request, now = Date.now()): boolean {
		this.prune(now);
		const token = cookieValue(request, this.cookieName);
		if (token?.length !== 43) return false;
		const session = this.sessions.get(digestHex(token));
		return Boolean(session && session.expiresAt > now);
	}

	logout(request: Request): string {
		const token = cookieValue(request, this.cookieName);
		if (token) this.sessions.delete(digestHex(token));
		return this.serializeCookie("", 0);
	}

	private prune(now: number): void {
		for (const [token, session] of this.sessions) {
			if (session.expiresAt <= now) this.sessions.delete(token);
		}
		for (const [clientId, attempt] of this.failures) {
			if (attempt.windowEndsAt <= now) this.failures.delete(clientId);
		}
	}

	private serializeCookie(value: string, ttlMs: number): string {
		const parts = [
			`${this.cookieName}=${value}`,
			"Path=/",
			"HttpOnly",
			"SameSite=Strict",
			`Max-Age=${Math.floor(ttlMs / 1_000)}`,
		];
		if (this.secureCookies) parts.push("Secure");
		return parts.join("; ");
	}
}

export function isSameOriginMutation(request: Request): boolean {
	if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return true;
	const origin = request.headers.get("origin");
	const fetchSite = request.headers.get("sec-fetch-site");
	if (!origin || fetchSite === "cross-site") return false;
	try {
		const originUrl = new URL(origin);
		const requestHost =
			request.headers.get("host") ?? new URL(request.url).host;
		return (
			(originUrl.protocol === "https:" || originUrl.protocol === "http:") &&
			originUrl.host === requestHost
		);
	} catch {
		return false;
	}
}
