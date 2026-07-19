import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";

const projectRoot = resolve(import.meta.dir, "..");
const { version } = (await Bun.file(
	resolve(projectRoot, "package.json"),
).json()) as {
	version: string;
};

async function verifyRelease(
	environment: Record<string, string>,
	requestedTag?: string,
) {
	const subprocess = Bun.spawn(
		[
			process.execPath,
			"run",
			"scripts/verifyRelease.ts",
			...(requestedTag ? [requestedTag] : []),
		],
		{
			cwd: projectRoot,
			env: { ...Bun.env, ...environment },
			stdout: "pipe",
			stderr: "pipe",
		},
	);

	const [exitCode, stdout, stderr] = await Promise.all([
		subprocess.exited,
		new Response(subprocess.stdout).text(),
		new Response(subprocess.stderr).text(),
	]);

	return { exitCode, output: `${stdout}${stderr}` };
}

describe("release metadata verification", () => {
	test("does not treat a branch name as a release tag", async () => {
		const result = await verifyRelease({
			GITHUB_REF_NAME: "main",
			GITHUB_REF_TYPE: "branch",
		});

		expect(result.exitCode).toBe(0);
		expect(result.output).toContain(
			`Release metadata is aligned at v${version}.`,
		);
	});

	test("rejects an actual tag that does not match the package version", async () => {
		const result = await verifyRelease({
			GITHUB_REF_NAME: "v9.9.9",
			GITHUB_REF_TYPE: "tag",
		});

		expect(result.exitCode).toBe(1);
		expect(result.output).toContain(
			`Release tag v9.9.9 does not match v${version}.`,
		);
	});

	test("accepts the explicit matching tag used by the release workflow", async () => {
		const result = await verifyRelease(
			{ GITHUB_REF_NAME: "main", GITHUB_REF_TYPE: "branch" },
			`v${version}`,
		);

		expect(result.exitCode).toBe(0);
	});
});
