import { desc, eq } from "drizzle-orm";
import type { ApiKey, NewApiKey } from "../../domain/entities";
import type {
	ApiKeyUpdate,
	ApiKeyWithWhitelists,
	IKeyRepository,
} from "../../domain/repositories/IKeyRepository";
import type { Database } from "../../db";
import { apiKeys, hwidWhitelists, ipWhitelists } from "../../db/schema";

function firstOrThrow<T>(rows: T[], action: string): T {
	const row = rows[0];
	if (!row) throw new Error(`Database returned no row after ${action}.`);
	return row;
}

type StoredApiKey = typeof apiKeys.$inferSelect;

function hashLicenseKey(key: string): string {
	return new Bun.CryptoHasher("sha256").update(key).digest("hex");
}

function keyPrefix(key: string): string {
	return key.slice(0, 12);
}

function toDomainApiKey(row: StoredApiKey, revealedKey?: string): ApiKey {
	const { keyHash: _keyHash, keyPrefix: storedPrefix, ...data } = row;
	return { ...data, key: revealedKey ?? `${storedPrefix}...` };
}

export class DrizzleKeyRepository implements IKeyRepository {
	constructor(private readonly db: Database) {}

	async create(data: NewApiKey): Promise<ApiKey> {
		const { key, ...persistedData } = data;
		const rows = await this.db
			.insert(apiKeys)
			.values({
				id: crypto.randomUUID(),
				...persistedData,
				keyHash: hashLicenseKey(key),
				keyPrefix: keyPrefix(key),
			})
			.returning();
		return toDomainApiKey(firstOrThrow(rows, "creating an API key"), key);
	}

	async findById(id: string): Promise<ApiKey | null> {
		const rows = await this.db
			.select()
			.from(apiKeys)
			.where(eq(apiKeys.id, id))
			.limit(1);
		return rows[0] ? toDomainApiKey(rows[0]) : null;
	}

	async findAll(): Promise<ApiKey[]> {
		const rows = await this.db
			.select()
			.from(apiKeys)
			.orderBy(desc(apiKeys.createdAt));
		return rows.map((row) => toDomainApiKey(row));
	}

	async update(id: string, data: ApiKeyUpdate): Promise<ApiKey> {
		const rows = await this.db
			.update(apiKeys)
			.set(data)
			.where(eq(apiKeys.id, id))
			.returning();
		return toDomainApiKey(firstOrThrow(rows, "updating an API key"));
	}

	async delete(id: string): Promise<void> {
		await this.db.delete(apiKeys).where(eq(apiKeys.id, id));
	}

	async findByKeyWithWhitelists(
		key: string,
	): Promise<ApiKeyWithWhitelists | null> {
		const hash = hashLicenseKey(key);
		const keys = await this.db
			.select()
			.from(apiKeys)
			.where(eq(apiKeys.keyHash, hash))
			.limit(1);
		const storedApiKey = keys[0];
		if (!storedApiKey) return null;
		const apiKey = toDomainApiKey(storedApiKey);

		const [whitelistedIps, whitelistedHwids] = await Promise.all([
			this.db
				.select()
				.from(ipWhitelists)
				.where(eq(ipWhitelists.apiKeyId, apiKey.id)),
			this.db
				.select()
				.from(hwidWhitelists)
				.where(eq(hwidWhitelists.apiKeyId, apiKey.id)),
		]);
		return { ...apiKey, whitelistedIps, whitelistedHwids };
	}
}
