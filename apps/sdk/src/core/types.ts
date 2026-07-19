/**
 * Defines the strictness level of the logging output by the LicenseClient.
 * - `none`: Silences all logs.
 * - `error`: Only logs errors.
 * - `warn`: Logs warnings and errors.
 * - `info`: Standard lifecycle logs.
 * - `debug`: Verbose logs for deep troubleshooting.
 */
export type LogLevel = "none" | "error" | "warn" | "info" | "debug";

/** License type returned by the server after validation. */
export type KeyType = "PERPETUAL" | "SUBSCRIPTION" | "USAGE";

/**
 * Configuration options for initializing the Keyzori LicenseClient.
 */
export interface LicenseClientConfig {
	/**
	 * The unique API Key issued to the user for this application.
	 */
	apiKey: string;

	/**
	 * The fully qualified URL of the Keyzori Licensing Server.
	 */
	serverUrl: string;

	/**
	 * Interval in milliseconds between successive heartbeat/handshake requests.
	 * @default 30000 (30 seconds)
	 */
	heartbeatIntervalMs?: number;

	/**
	 * The number of consecutive failed heartbeats allowed before the client forcefully closes.
	 * @default 2
	 */
	maxRetries?: number;

	/**
	 * Maximum duration in milliseconds for each handshake or logout request.
	 * @default 10000 (10 seconds)
	 */
	requestTimeoutMs?: number;

	/**
	 * Logging level for the client's internal output.
	 * @default "none"
	 */
	logLevel?: LogLevel;
}

/**
 * A mapping of all lifecycle events emitted by LicenseClient.
 * You can subscribe to these using `client.events.on('eventName', callback)`.
 */
export interface LicenseEventMap {
	/**
	 * Emitted exactly once when the initial handshake completes successfully.
	 * @param customFields - The arbitrary JSON data attached to the user's API Key.
	 */
	ready: (customFields: Record<string, unknown>) => void;

	/**
	 * Emitted every time a recurring heartbeat completes successfully.
	 */
	"heartbeat:success": () => void;

	/**
	 * Emitted when a heartbeat fails but has not yet exceeded `maxRetries`.
	 * @param error - The HTTP or network error message.
	 * @param strikes - The current number of consecutive failures.
	 */
	"heartbeat:failed": (error: string, strikes: number) => void;

	/**
	 * Emitted if the server explicitly rejects the license due to revocation or admin action.
	 * @param reason - Server provided reason for revocation.
	 */
	"license:revoked": (reason: string) => void;

	/**
	 * Emitted if a Trial or Subscription period has expired.
	 * @param reason - Server provided explanation for the expiration.
	 */
	"license:expired": (reason: string) => void;

	/**
	 * Emitted when consecutive heartbeat failures exceed `maxRetries`.
	 * The client will forcefully destroy itself immediately after this event.
	 * @param error - The final network error that caused the disconnection.
	 */
	"network:offline": (error: string) => void;
}

/** Lifecycle event subscriptions exposed by LicenseClient. */
export interface LicenseEvents {
	on<K extends keyof LicenseEventMap>(
		event: K,
		listener: LicenseEventMap[K],
	): void;
	once<K extends keyof LicenseEventMap>(
		event: K,
		listener: LicenseEventMap[K],
	): void;
	removeListener<K extends keyof LicenseEventMap>(
		event: K,
		listener: LicenseEventMap[K],
	): void;
}
