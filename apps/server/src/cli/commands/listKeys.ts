import type { Command } from "commander";
import type { AdminOperations } from "../AdminOperations";
import { reportCommandError } from "../commandError";

export const registerListKeysCommand = (
	program: Command,
	getService: () => AdminOperations,
): void => {
	program
		.command("list-keys")
		.description("List API keys with masked secrets")
		.action(async () => {
			try {
				const keys = await getService().listKeys();
				if (keys.length === 0) {
					console.log("No API keys found.");
				} else {
					console.table(
						keys.map((key) => ({
							ID: key.id,
							Key: key.key,
							User: key.userId,
							Type: key.type,
							Revoked: key.revoked ? "YES" : "NO",
						})),
					);
				}
			} catch (error) {
				reportCommandError("Failed to list keys", error);
			}
		});
};
