import type { Command } from "commander";
import type { AdminOperations } from "../AdminOperations";
import { reportCommandError } from "../commandError";

export function registerUserCommands(
	program: Command,
	getService: () => AdminOperations,
): void {
	program
		.command("create-user")
		.description("Create a license owner")
		.requiredOption("-e, --email <email>", "User email")
		.requiredOption("-n, --name <name>", "User name")
		.action(async (options: { email: string; name: string }) => {
			try {
				console.log(
					JSON.stringify(
						await getService().createUser(options.email, options.name),
						null,
						2,
					),
				);
			} catch (error) {
				reportCommandError("Failed to create user", error);
			}
		});

	program
		.command("list-users")
		.description("List license owners")
		.action(async () => {
			try {
				const users = await getService().listUsers();
				console.table(
					users.map((user) => ({
						ID: user.id,
						Email: user.email,
						Name: user.name,
					})),
				);
			} catch (error) {
				reportCommandError("Failed to list users", error);
			}
		});
}
