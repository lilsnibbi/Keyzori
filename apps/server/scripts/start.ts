import { existsSync } from "node:fs";
import { resolve } from "node:path";

const appDirectory = resolve(import.meta.dir, "..");
const executable = resolve(
	appDirectory,
	"dist",
	process.platform === "win32" ? "keyzori-server.exe" : "keyzori-server",
);

if (!existsSync(executable)) {
	console.error("Server binary is missing. Run `bun run build:server` first.");
	process.exit(1);
}

const server = Bun.spawn([executable, ...process.argv.slice(2)], {
	stdin: "inherit",
	stdout: "inherit",
	stderr: "inherit",
	env: Bun.env,
});

process.exit(await server.exited);
