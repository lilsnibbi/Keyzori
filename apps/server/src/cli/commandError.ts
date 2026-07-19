export function reportCommandError(action: string, error: unknown): void {
	console.error(
		`${action}: ${error instanceof Error ? error.message : String(error)}`,
	);
	process.exitCode = 1;
}
