import type {
	ApiKey,
	HwidWhitelist,
	IpWhitelist,
	NewApiKey,
} from "../entities";

export type ApiKeyWithWhitelists = ApiKey & {
	whitelistedIps: IpWhitelist[];
	whitelistedHwids: HwidWhitelist[];
};

export type ApiKeyUpdate = Partial<
	Pick<
		ApiKey,
		| "userId"
		| "type"
		| "limitIp"
		| "limitHwid"
		| "limitConcurrent"
		| "limitUsage"
		| "trialDurationMin"
		| "firstActivatedAt"
		| "customFields"
		| "expiresAt"
		| "revoked"
	>
>;

export interface IKeyRepository {
	create(data: NewApiKey): Promise<ApiKey>;
	findById(id: string): Promise<ApiKey | null>;
	findAll(): Promise<ApiKey[]>;
	update(id: string, data: ApiKeyUpdate): Promise<ApiKey>;
	delete(id: string): Promise<void>;
	findByKeyWithWhitelists(key: string): Promise<ApiKeyWithWhitelists | null>;
}
