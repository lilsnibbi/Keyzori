import type { KeyDeviceMapping, RegisteredDevice } from "../entities";

export interface KeyDeviceUsage {
	uniqueIps: number;
	uniqueHwids: number;
	ipRegistered: boolean;
	hwidRegistered: boolean;
}

export interface IDeviceRepository {
	withKeyRegistrationLock<T>(
		apiKeyId: string,
		operation: (repository: IDeviceRepository) => Promise<T>,
	): Promise<T>;
	findDevice(ip: string, hwid: string): Promise<RegisteredDevice | null>;
	createDevice(ip: string, hwid: string): Promise<RegisteredDevice>;
	getKeyDeviceUsage(
		apiKeyId: string,
		ip: string,
		hwid: string,
	): Promise<KeyDeviceUsage>;
	findMapping(
		apiKeyId: string,
		deviceId: string,
	): Promise<KeyDeviceMapping | null>;
	createMapping(apiKeyId: string, deviceId: string): Promise<KeyDeviceMapping>;
	consumeUsage(apiKeyId: string): Promise<boolean>;
}
