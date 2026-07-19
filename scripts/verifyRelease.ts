interface PackageManifest {
	version?: string;
	license?: string;
}

const manifests = [
	"package.json",
	"apps/server/package.json",
	"apps/sdk/package.json",
] as const;

async function readManifest(
	path: (typeof manifests)[number],
): Promise<PackageManifest> {
	const value: unknown = await Bun.file(path).json();
	if (!value || typeof value !== "object") {
		throw new Error(`${path} does not contain a package manifest.`);
	}
	return value as PackageManifest;
}

const packages = await Promise.all(manifests.map(readManifest));
const versions = packages.map((manifest) => manifest.version);
const version = versions[0];

if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
	throw new Error("The release version must use MAJOR.MINOR.PATCH format.");
}
if (versions.some((candidate) => candidate !== version)) {
	throw new Error(
		`Workspace versions must match: ${manifests.map((path, index) => `${path}=${versions[index] ?? "missing"}`).join(", ")}`,
	);
}
if (packages.some((manifest) => manifest.license !== "Apache-2.0")) {
	throw new Error("Every workspace package must declare Apache-2.0.");
}

const changelog = await Bun.file("CHANGELOG.md").text();
if (!changelog.includes(`## [${version}]`)) {
	throw new Error(
		`CHANGELOG.md must include a ## [${version}] release section.`,
	);
}

const requestedTag = process.argv[2] ?? Bun.env.GITHUB_REF_NAME;
if (requestedTag && requestedTag !== `v${version}`) {
	throw new Error(`Release tag ${requestedTag} does not match v${version}.`);
}

console.log(`Release metadata is aligned at v${version}.`);
