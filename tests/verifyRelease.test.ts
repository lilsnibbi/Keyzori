import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";

const projectRoot = resolve(import.meta.dir, "..");

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
		expect(result.output).toContain("Release metadata is aligned at v1.0.0.");
	});

	test("rejects an actual tag that does not match the package version", async () => {
		const result = await verifyRelease({
			GITHUB_REF_NAME: "v9.9.9",
			GITHUB_REF_TYPE: "tag",
		});

		expect(result.exitCode).toBe(1);
		expect(result.output).toContain(
			"Release tag v9.9.9 does not match v1.0.0.",
		);
	});

	test("accepts the explicit matching tag used by the release workflow", async () => {
		const result = await verifyRelease(
			{ GITHUB_REF_NAME: "main", GITHUB_REF_TYPE: "branch" },
			"v1.0.0",
		);

		expect(result.exitCode).toBe(0);
	});
});
