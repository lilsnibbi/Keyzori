import { DomainError, NotFoundError } from "../../domain/errors";
import type { ApiKey, JsonObject, KeyType, User } from "../../domain/entities";
import type { IKeyRepository } from "../../domain/repositories/IKeyRepository";
import type { IUserRepository } from "../../domain/repositories/IUserRepository";

export interface CreateKeyInput {
	userId: string;
	type: KeyType;
	limitIp?: number;
	limitHwid?: number;
	limitConcurrent?: number;
	limitUsage?: number;
	trialDurationMin?: number;
	customFields?: JsonObject;
	expiresAt?: string;
}

export class AdminService {
	constructor(
		private readonly keyRepo: IKeyRepository,
		private readonly userRepo: IUserRepository,
	) {}

	async createUser(email: string, name: string): Promise<User> {
		const normalizedEmail = email.trim().toLowerCase();
		const normalizedName = name.trim();
		if (!normalizedName) throw new DomainError("User name is required");
		return await this.userRepo.create(normalizedEmail, normalizedName);
	}

	async listUsers(): Promise<User[]> {
		return await this.userRepo.findAll();
	}

	async createKey(data: CreateKeyInput): Promise<ApiKey> {
		const limits = [
			data.limitIp,
			data.limitHwid,
			data.limitConcurrent,
			data.limitUsage,
			data.trialDurationMin,
		].filter((value): value is number => value !== undefined);
		if (limits.some((value) => !Number.isInteger(value) || value < 0)) {
			throw new DomainError("License limits must be non-negative integers");
		}
		if (!(await this.userRepo.findById(data.userId))) {
			throw new NotFoundError("User");
		}
		if (data.type === "USAGE" && (data.limitUsage ?? 0) < 1) {
			throw new DomainError("USAGE keys require limitUsage greater than zero");
		}
		if (data.type === "SUBSCRIPTION" && !data.expiresAt) {
			throw new DomainError("SUBSCRIPTION keys require expiresAt");
		}
		if (data.type !== "SUBSCRIPTION" && data.expiresAt) {
			throw new DomainError("expiresAt is only valid for SUBSCRIPTION keys");
		}

		const expiresAt = data.expiresAt ? new Date(data.expiresAt) : null;
		if (
			expiresAt &&
			(Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date())
		) {
			throw new DomainError("expiresAt must be a valid future date");
		}

		return await this.keyRepo.create({
			key: `sk_${Bun.randomUUIDv7()}`,
			userId: data.userId,
			type: data.type,
			limitIp: data.limitIp ?? 0,
			limitHwid: data.limitHwid ?? 0,
			limitConcurrent: data.limitConcurrent ?? 0,
			limitUsage: data.limitUsage ?? 0,
			trialDurationMin: data.trialDurationMin ?? 0,
			firstActivatedAt: null,
			customFields: data.customFields ?? {},
			expiresAt,
		});
	}

	async listKeys(): Promise<ApiKey[]> {
		return await this.keyRepo.findAll();
	}

	async revokeKey(id: string): Promise<ApiKey> {
		const key = await this.keyRepo.findById(id);
		if (!key) throw new NotFoundError("ApiKey");
		return await this.keyRepo.update(id, { revoked: true });
	}
}
