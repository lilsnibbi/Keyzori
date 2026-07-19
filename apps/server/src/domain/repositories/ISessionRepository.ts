export type SessionRegistrationResult =
	| { status: "registered"; token: string }
	| { status: "limit-reached" };

export interface SessionBinding {
	ip: string;
	hwid: string;
}

export interface ISessionRepository {
	registerSession(
		apiKeyId: string,
		binding: SessionBinding,
		ttlSeconds: number,
		maxConcurrent: number,
	): Promise<SessionRegistrationResult>;
	refreshSession(
		apiKeyId: string,
		sessionToken: string,
		binding: SessionBinding,
		ttlSeconds: number,
	): Promise<boolean>;
	removeSession(
		apiKeyId: string,
		sessionToken: string,
		binding: SessionBinding,
	): Promise<boolean>;
}
