import { EventBroker } from "./EventBroker";
import { HardwareManager } from "./HardwareManager";
import { NetworkClient } from "./NetworkClient";
import type {
	KeyType,
	LicenseClientConfig,
	LicenseEvents,
	LogLevel,
} from "./types";

interface HandshakePayload {
	success: true;
	type: KeyType;
	customFields: Record<string, unknown>;
	sessionToken: string;
}

const DEFAULT_MAX_RESPONSE_BODY_BYTES = 262_144;

type ClientState = "idle" | "initializing" | "active" | "destroyed";

const LOG_LEVELS: Record<LogLevel, number> = {
	none: 0,
	error: 1,
	warn: 2,
	info: 3,
	debug: 4,
};

/** Manages license verification, session tracking, and recurring heartbeats. */
export class LicenseClient {
	public readonly events: LicenseEvents;

	private readonly hardware = new HardwareManager();
	private readonly network: NetworkClient;
	private readonly eventBroker: EventBroker;
	private readonly heartbeatIntervalMs: number;
	private readonly maxRetries: number;
	private readonly logLevel: LogLevel;
	private heartbeatTimer?: ReturnType<typeof setTimeout>;
	private initialization?: Promise<Record<string, unknown>>;
	private destruction?: Promise<void>;
	private customFields?: Record<string, unknown>;
	private state: ClientState = "idle";
	private failureStrikes = 0;

	constructor(config: LicenseClientConfig) {
		this.assertConfig(config);
		this.logLevel = config.logLevel ?? "none";
		this.eventBroker = new EventBroker(() => {
			this.log("warn", "A license event listener threw an error");
		});
		this.events = this.eventBroker;
		this.network = new NetworkClient(
			config.serverUrl,
			config.apiKey,
			config.requestTimeoutMs ?? 10_000,
		);
		this.heartbeatIntervalMs = config.heartbeatIntervalMs ?? 30_000;
		this.maxRetries = config.maxRetries ?? 2;
	}

	/** Validates the license once and starts heartbeats after success. */
	public initialize(): Promise<Record<string, unknown>> {
		if (this.state === "destroyed") {
			return Promise.reject(new Error("LicenseClient has been destroyed"));
		}
		if (this.state === "active" && this.customFields) {
			return Promise.resolve(this.customFields);
		}
		if (this.initialization) return this.initialization;

		this.state = "initializing";
		this.initialization = this.initializeOnce();
		return this.initialization;
	}

	private async initializeOnce(): Promise<Record<string, unknown>> {
		try {
			const response = await this.network.sendHandshake(
				this.hardware.getHwid(),
			);
			if (!response.ok) {
				throw new Error(`License Block: ${await this.readError(response)}`);
			}

			const payload = await this.readHandshake(response);
			if (this.state === "destroyed") {
				throw new Error("LicenseClient was destroyed during initialization");
			}
			this.customFields = payload.customFields;
			this.network.setSessionToken(payload.sessionToken);
			this.state = "active";
			this.eventBroker.emit("ready", payload.customFields);
			this.log("info", `License initialized as ${payload.type}`);
			this.scheduleHeartbeat();
			return payload.customFields;
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Initialization failed";
			if (this.state !== "destroyed") this.handleFatalError(message);
			throw error;
		}
	}

	private async readHandshake(response: Response): Promise<HandshakePayload> {
		const payload = await this.readJson(response);
		if (
			!payload ||
			typeof payload !== "object" ||
			!("success" in payload) ||
			payload.success !== true ||
			!("type" in payload) ||
			!this.isKeyType(payload.type) ||
			!("customFields" in payload) ||
			!payload.customFields ||
			typeof payload.customFields !== "object" ||
			Array.isArray(payload.customFields) ||
			!("sessionToken" in payload) ||
			typeof payload.sessionToken !== "string" ||
			payload.sessionToken.length < 32
		) {
			throw new Error("License server returned an invalid handshake response");
		}
		return {
			success: true,
			type: payload.type,
			customFields: payload.customFields as Record<string, unknown>,
			sessionToken: payload.sessionToken,
		};
	}

	private isKeyType(value: unknown): value is KeyType {
		return (
			value === "PERPETUAL" || value === "SUBSCRIPTION" || value === "USAGE"
		);
	}

	private async readError(response: Response): Promise<string> {
		const payload = await this.readJson(response);
		if (
			payload !== null &&
			typeof payload === "object" &&
			"error" in payload &&
			typeof payload.error === "string"
		) {
			return payload.error;
		}
		return `HTTP ${response.status}`;
	}

	private async readJson(response: Response): Promise<unknown> {
		const declaredLength = response.headers.get("content-length");
		if (
			declaredLength !== null &&
			Number.isFinite(Number(declaredLength)) &&
			Number(declaredLength) > DEFAULT_MAX_RESPONSE_BODY_BYTES
		) {
			throw new Error("License server response exceeded the safety limit");
		}

		if (!response.body) return undefined;
		const reader = response.body.getReader();
		const chunks: Uint8Array[] = [];
		let length = 0;
		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				length += value.byteLength;
				if (length > DEFAULT_MAX_RESPONSE_BODY_BYTES) {
					await reader.cancel();
					throw new Error("License server response exceeded the safety limit");
				}
				chunks.push(value);
			}
		} finally {
			reader.releaseLock();
		}

		const bytes = new Uint8Array(length);
		let offset = 0;
		for (const chunk of chunks) {
			bytes.set(chunk, offset);
			offset += chunk.byteLength;
		}
		try {
			return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
		} catch {
			return undefined;
		}
	}

	private scheduleHeartbeat(): void {
		if (this.state !== "active") return;
		this.heartbeatTimer = setTimeout(
			() => void this.runHeartbeat(),
			this.heartbeatIntervalMs,
		);
		this.heartbeatTimer.unref();
	}

	private async runHeartbeat(): Promise<void> {
		if (this.state !== "active") return;
		try {
			const response = await this.network.sendHandshake(
				this.hardware.getHwid(),
			);
			if (!response.ok) {
				if (response.status === 403) {
					const reason = await this.readError(response);
					this.eventBroker.emit(
						/expired/i.test(reason) ? "license:expired" : "license:revoked",
						reason,
					);
					this.handleFatalError(reason);
					return;
				}
				this.recordHeartbeatFailure(`HTTP ${response.status}`);
				return;
			}

			await this.readHandshake(response);
			this.failureStrikes = 0;
			this.eventBroker.emit("heartbeat:success");
			this.log("debug", "Heartbeat succeeded");
		} catch (error) {
			this.recordHeartbeatFailure(
				error instanceof Error ? error.message : "Network error",
			);
		} finally {
			this.scheduleHeartbeat();
		}
	}

	private recordHeartbeatFailure(message: string): void {
		this.failureStrikes++;
		this.eventBroker.emit("heartbeat:failed", message, this.failureStrikes);
		this.log("warn", `Heartbeat failed: ${message}`);
		if (this.failureStrikes >= this.maxRetries) {
			this.eventBroker.emit("network:offline", message);
			this.handleFatalError(message);
		}
	}

	private handleFatalError(reason: string): void {
		this.log("error", `FATAL ERROR: ${reason}`);
		void this.destroy();
	}

	/** Stops heartbeats and releases the server-side session. Safe to call twice. */
	public destroy(): Promise<void> {
		if (this.destruction) return this.destruction;
		this.state = "destroyed";
		if (this.heartbeatTimer) clearTimeout(this.heartbeatTimer);
		this.destruction = this.releaseSession();
		return this.destruction;
	}

	private async releaseSession(): Promise<void> {
		try {
			await this.network.sendLogout(this.hardware.getHwid());
		} catch {
			this.log("warn", "Could not release the license session");
		} finally {
			this.eventBroker.removeAllListeners();
		}
	}

	private assertConfig(config: LicenseClientConfig): void {
		if (!config.apiKey.trim()) throw new Error("apiKey is required");
		for (const [name, value] of [
			["heartbeatIntervalMs", config.heartbeatIntervalMs],
			["maxRetries", config.maxRetries],
			["requestTimeoutMs", config.requestTimeoutMs],
		] as const) {
			if (value !== undefined && (!Number.isInteger(value) || value < 1)) {
				throw new Error(`${name} must be a positive integer`);
			}
		}
	}

	private log(level: Exclude<LogLevel, "none">, message: string): void {
		if (LOG_LEVELS[this.logLevel] < LOG_LEVELS[level]) return;
		const output = `[LicenseClient] ${message}`;
		if (level === "error") console.error(output);
		else if (level === "warn") console.warn(output);
		else console.info(output);
	}
}
