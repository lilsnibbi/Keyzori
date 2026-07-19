import { cp, rm, stat } from "node:fs/promises";
import { resolve } from "node:path";

const appDirectory = resolve(import.meta.dir, "..");
const outputDirectory = resolve(appDirectory, "dist");
const serverOutputFile = resolve(outputDirectory, "keyzori-server");
const cliOutputFile = resolve(outputDirectory, "keyzori-admin");

await rm(outputDirectory, { recursive: true, force: true });

const builds = [
	{
		entrypoint: resolve(appDirectory, "src/index.ts"),
		outfile: serverOutputFile,
	},
	{
		entrypoint: resolve(appDirectory, "src/cli/index.ts"),
		outfile: cliOutputFile,
	},
];

for (const build of builds) {
	const result = await Bun.build({
		entrypoints: [build.entrypoint],
		compile: { outfile: build.outfile },
		minify: true,
		bytecode: true,
	});
	if (!result.success) {
		for (const log of result.logs) console.error(log);
		process.exit(1);
	}
}

await cp(
	resolve(appDirectory, "drizzle"),
	resolve(outputDirectory, "drizzle"),
	{
		recursive: true,
	},
);

for (const legalFile of ["LICENSE", "NOTICE"] as const) {
	await cp(
		resolve(appDirectory, "../..", legalFile),
		resolve(outputDirectory, legalFile),
	);
}

for (const build of builds) {
	const executable =
		process.platform === "win32" ? `${build.outfile}.exe` : build.outfile;
	const executableStats = await stat(executable);
	console.log(
		`Compiled ${executable} (${(executableStats.size / 1024 / 1024).toFixed(1)} MiB)`,
	);
}
