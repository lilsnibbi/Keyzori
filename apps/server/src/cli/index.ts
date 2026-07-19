#!/usr/bin/env bun
import { Command } from "commander";
import { createAdminService } from "../composition/services";
import type { AdminOperations } from "./AdminOperations";
import { registerCreateKeyCommand } from "./commands/createKey";
import { registerListKeysCommand } from "./commands/listKeys";
import { registerRevokeKeyCommand } from "./commands/revokeKey";
import { registerUserCommands } from "./commands/users";

function createRuntimeAdminService(): AdminOperations {
	if (!Bun.env.DATABASE_URL?.trim()) {
		throw new Error("DATABASE_URL must be configured.");
	}
	return createAdminService();
}

export function createProgram(
	getAdminService: () => AdminOperations = createRuntimeAdminService,
): Command {
	const program = new Command();
	program
		.name("keyzori-admin")
		.description("Administer the local Keyzori server database")
		.version("0.2.1-test.1");

	let cachedService: AdminOperations | undefined;
	const getService = (): AdminOperations => {
		cachedService ??= getAdminService();
		return cachedService;
	};

	registerUserCommands(program, getService);
	registerCreateKeyCommand(program, getService);
	registerListKeysCommand(program, getService);
	registerRevokeKeyCommand(program, getService);
	return program;
}

async function main(): Promise<void> {
	await createProgram().parseAsync(process.argv);
}

if (import.meta.main) {
	main().catch((error: unknown) => {
		console.error(error instanceof Error ? error.message : String(error));
		process.exit(1);
	});
}
