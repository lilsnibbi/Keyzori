export type KeyType = "PERPETUAL" | "SUBSCRIPTION" | "USAGE";

export interface JsonObject {
	[key: string]: JsonValue;
}

export interface JsonArray extends Array<JsonValue> {}

export type JsonValue =
	| string
	| number
	| boolean
	| null
	| JsonObject
	| JsonArray;

export interface User {
	id: string;
	email: string;
	name: string;
	createdAt: Date;
}

export interface ApiKey {
	id: string;
	key: string;
	userId: string;
	type: KeyType;
	limitIp: number;
	limitHwid: number;
	limitConcurrent: number;
	limitUsage: number;
	trialDurationMin: number;
	firstActivatedAt: Date | null;
	customFields: JsonObject;
	expiresAt: Date | null;
	revoked: boolean;
	createdAt: Date;
}

export interface IpWhitelist {
	id: string;
	apiKeyId: string;
	ip: string;
	createdAt: Date;
}

export interface HwidWhitelist {
	id: string;
	apiKeyId: string;
	hwid: string;
	createdAt: Date;
}

export interface RegisteredDevice {
	id: string;
	ip: string;
	hwid: string;
	createdAt: Date;
}

export interface KeyDeviceMapping {
	id: string;
	apiKeyId: string;
	registeredDeviceId: string;
	createdAt: Date;
}

export interface NewApiKey {
	key: string;
	userId: string;
	type: KeyType;
	limitIp: number;
	limitHwid: number;
	limitConcurrent: number;
	limitUsage: number;
	trialDurationMin: number;
	firstActivatedAt: Date | null;
	customFields: JsonObject;
	expiresAt: Date | null;
}
