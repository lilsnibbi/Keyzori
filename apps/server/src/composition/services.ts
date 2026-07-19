import { AdminService } from "../application/services/AdminService";
import { HandshakeService } from "../application/services/HandshakeService";
import { db, type Database } from "../db";
import { DrizzleDeviceRepository } from "../infrastructure/repositories/DrizzleDeviceRepository";
import { DrizzleKeyRepository } from "../infrastructure/repositories/DrizzleKeyRepository";
import { DrizzleUserRepository } from "../infrastructure/repositories/DrizzleUserRepository";
import type { ISessionRepository } from "../domain/repositories/ISessionRepository";

export function createAdminService(database: Database = db): AdminService {
	return new AdminService(
		new DrizzleKeyRepository(database),
		new DrizzleUserRepository(database),
	);
}

export function createHandshakeService(
	sessionRepository: ISessionRepository,
	database: Database = db,
): HandshakeService {
	return new HandshakeService(
		new DrizzleKeyRepository(database),
		new DrizzleDeviceRepository(database),
		sessionRepository,
	);
}
