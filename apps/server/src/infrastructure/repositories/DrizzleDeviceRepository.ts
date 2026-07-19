import { and, countDistinct, eq, gt, sql } from "drizzle-orm";
import type { KeyDeviceMapping, RegisteredDevice } from "../../domain/entities";
import type {
	IDeviceRepository,
	KeyDeviceUsage,
} from "../../domain/repositories/IDeviceRepository";
import type { Database } from "../../db";
import { apiKeys, keyDeviceMappings, registeredDevices } from "../../db/schema";

type DatabaseTransaction = Parameters<
	Parameters<Database["transaction"]>[0]
>[0];
type DeviceDatabase = Database | DatabaseTransaction;

export class DrizzleDeviceRepository implements IDeviceRepository {
	private readonly db: DeviceDatabase;
	private readonly transactionRunner: Database | null;

	constructor(db: DeviceDatabase, transactionRunner?: Database | null) {
		this.db = db;
		this.transactionRunner =
			transactionRunner === undefined ? (db as Database) : transactionRunner;
	}

	async withKeyRegistrationLock<T>(
		apiKeyId: string,
		operation: (repository: IDeviceRepository) => Promise<T>,
	): Promise<T> {
		if (!this.transactionRunner) return await operation(this);
		return await this.transactionRunner.transaction(async (transaction) => {
			await transaction.execute(
				sql`select pg_advisory_xact_lock(hashtextextended(${apiKeyId}, 0))`,
			);
			return await operation(new DrizzleDeviceRepository(transaction, null));
		});
	}

	async findDevice(ip: string, hwid: string): Promise<RegisteredDevice | null> {
		const rows = await this.db
			.select()
			.from(registeredDevices)
			.where(
				and(eq(registeredDevices.ip, ip), eq(registeredDevices.hwid, hwid)),
			)
			.limit(1);
		return rows[0] ?? null;
	}

	async createDevice(ip: string, hwid: string): Promise<RegisteredDevice> {
		const rows = await this.db
			.insert(registeredDevices)
			.values({ id: crypto.randomUUID(), ip, hwid })
			.onConflictDoNothing()
			.returning();
		const device = rows[0] ?? (await this.findDevice(ip, hwid));
		if (!device) throw new Error("Database returned no created device.");
		return device;
	}

	async getKeyDeviceUsage(
		apiKeyId: string,
		ip: string,
		hwid: string,
	): Promise<KeyDeviceUsage> {
		const baseJoin = this.db
			.select({
				uniqueIps: countDistinct(registeredDevices.ip),
				uniqueHwids: countDistinct(registeredDevices.hwid),
			})
			.from(keyDeviceMappings)
			.innerJoin(
				registeredDevices,
				eq(keyDeviceMappings.registeredDeviceId, registeredDevices.id),
			)
			.where(eq(keyDeviceMappings.apiKeyId, apiKeyId));

		const [counts, ipRows, hwidRows] = await Promise.all([
			baseJoin,
			this.db
				.select({ id: registeredDevices.id })
				.from(keyDeviceMappings)
				.innerJoin(
					registeredDevices,
					eq(keyDeviceMappings.registeredDeviceId, registeredDevices.id),
				)
				.where(
					and(
						eq(keyDeviceMappings.apiKeyId, apiKeyId),
						eq(registeredDevices.ip, ip),
					),
				)
				.limit(1),
			this.db
				.select({ id: registeredDevices.id })
				.from(keyDeviceMappings)
				.innerJoin(
					registeredDevices,
					eq(keyDeviceMappings.registeredDeviceId, registeredDevices.id),
				)
				.where(
					and(
						eq(keyDeviceMappings.apiKeyId, apiKeyId),
						eq(registeredDevices.hwid, hwid),
					),
				)
				.limit(1),
		]);

		return {
			uniqueIps: counts[0]?.uniqueIps ?? 0,
			uniqueHwids: counts[0]?.uniqueHwids ?? 0,
			ipRegistered: ipRows.length > 0,
			hwidRegistered: hwidRows.length > 0,
		};
	}

	async findMapping(
		apiKeyId: string,
		deviceId: string,
	): Promise<KeyDeviceMapping | null> {
		const rows = await this.db
			.select()
			.from(keyDeviceMappings)
			.where(
				and(
					eq(keyDeviceMappings.apiKeyId, apiKeyId),
					eq(keyDeviceMappings.registeredDeviceId, deviceId),
				),
			)
			.limit(1);
		return rows[0] ?? null;
	}

	async createMapping(
		apiKeyId: string,
		deviceId: string,
	): Promise<KeyDeviceMapping> {
		const rows = await this.db
			.insert(keyDeviceMappings)
			.values({
				id: crypto.randomUUID(),
				apiKeyId,
				registeredDeviceId: deviceId,
			})
			.returning();
		const mapping = rows[0];
		if (!mapping) throw new Error("Database returned no device mapping.");
		return mapping;
	}

	async consumeUsage(apiKeyId: string): Promise<boolean> {
		const rows = await this.db
			.update(apiKeys)
			.set({ limitUsage: sql`${apiKeys.limitUsage} - 1` })
			.where(and(eq(apiKeys.id, apiKeyId), gt(apiKeys.limitUsage, 0)))
			.returning({ id: apiKeys.id });
		return rows.length === 1;
	}
}
