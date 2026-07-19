import type { Command } from "commander";
import type { AdminOperations } from "../AdminOperations";
import { reportCommandError } from "../commandError";

export const registerRevokeKeyCommand = (
	program: Command,
	getService: () => AdminOperations,
): void => {
	program
		.command("revoke-key")
		.description("Revoke an API key")
		.requiredOption("-i, --id <id>", "API Key ID")
		.action(async (options: { id: string }) => {
			try {
				const key = await getService().revokeKey(options.id);
				console.log(`Key ${options.id} has been revoked successfully.`);
				console.log(JSON.stringify(key, null, 2));
			} catch (error) {
				reportCommandError("Failed to revoke key", error);
			}
		});
};
