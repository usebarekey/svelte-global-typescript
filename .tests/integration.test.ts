import { tmpdir } from "node:os";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { delimiter, dirname, join } from "node:path";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";

const repo_root = dirname(fileURLToPath(import.meta.url));
const package_root = dirname(repo_root);
const vp_bin = process.env.VP_BIN ?? "vp";

describe("SvelteKit integration", () => {
	test("builds globally typed .svelte and .sv components", async () => {
		const fixture_dir = await mkdtemp(join(tmpdir(), "svelte-global-typescript-"));

		try {
			await run_vp(package_root, ["pack"]);
			await write_fixture(fixture_dir);
			await run_vp(fixture_dir, ["install"]);
			await run_vp(fixture_dir, ["exec", "svelte-kit", "sync"]);

			const build_result = await run_vp(fixture_dir, ["build"]);

			expect(build_result.output).toContain("built");

			const root_html = await readFile(join(fixture_dir, "build", "index.html"), "utf8");

			expect(root_html).toContain("Svelte route");
			expect(root_html).toContain("from no-script markup");
			expect(root_html).toContain("from sv component");
		} finally {
			await rm(fixture_dir, { force: true, recursive: true });
		}
	}, 120_000);
});

async function write_fixture(fixture_dir: string): Promise<void> {
	await write_text(
		fixture_dir,
		"package.json",
		`${JSON.stringify(
			{
				type: "module",
				private: true,
				dependencies: {
					"@jridgewell/sourcemap-codec": "^1.5.5",
					"@sveltejs/adapter-static": "^3.0.0",
					"@sveltejs/kit": "^2.0.0",
					"magic-string": "^0.30.21",
					svelte: "^5.0.0",
					"svelte-global-typescript": `file:${package_root.replace(/\\/g, "/")}`,
					vite: "8.1.3",
				},
				devEngines: {
					packageManager: {
						name: "pnpm",
						version: "11.10.0",
						onFail: "download",
					},
				},
			},
			null,
			"\t",
		)}\n`,
	);

	await write_text(
		fixture_dir,
		"svelte.config.js",
		[
			`import adapter from "@sveltejs/adapter-static";`,
			`import { ts } from "svelte-global-typescript";`,
			"",
			"export default {",
			`\textensions: [".svelte", ".sv"],`,
			"\tpreprocess: [ts()],",
			"\tkit: {",
			"\t\tadapter: adapter(),",
			"\t},",
			"};",
			"",
		].join("\n"),
	);

	await write_text(
		fixture_dir,
		"vite.config.ts",
		[
			`import { sveltekit } from "@sveltejs/kit/vite";`,
			`import { defineConfig } from "vite";`,
			"",
			"export default defineConfig({",
			"\tplugins: [sveltekit()],",
			"});",
			"",
		].join("\n"),
	);

	await write_text(
		fixture_dir,
		"tsconfig.json",
		`${JSON.stringify(
			{
				extends: "./.svelte-kit/tsconfig.json",
				compilerOptions: {
					allowJs: true,
					checkJs: true,
					esModuleInterop: true,
					forceConsistentCasingInFileNames: true,
					resolveJsonModule: true,
					skipLibCheck: true,
					sourceMap: true,
					strict: true,
					moduleResolution: "bundler",
				},
			},
			null,
			"\t",
		)}\n`,
	);

	await write_text(
		fixture_dir,
		"src/app.html",
		[
			"<!doctype html>",
			`<html lang="en">`,
			"\t<head>",
			`\t\t<meta charset="utf-8" />`,
			`\t\t<meta name="viewport" content="width=device-width, initial-scale=1" />`,
			"\t\t%sveltekit.head%",
			"\t</head>",
			"\t<body>",
			"\t\t<div>%sveltekit.body%</div>",
			"\t</body>",
			"</html>",
			"",
		].join("\n"),
	);

	await write_text(fixture_dir, "src/routes/+layout.ts", "export const prerender = true;\n");

	await write_text(
		fixture_dir,
		"src/routes/+page.svelte",
		[
			"<script>",
			`\timport NoScript from "$lib/no-script.svelte";`,
			`\timport FromSv from "$lib/from-sv.sv";`,
			"",
			`\tlet title: string = "Svelte route";`,
			"</script>",
			"",
			"<h1>{title}</h1>",
			"<NoScript />",
			"<FromSv />",
			"",
		].join("\n"),
	);

	await write_text(
		fixture_dir,
		"src/lib/no-script.svelte",
		`<p>{("from no-script markup" as string)}</p>\n`,
	);

	await write_text(
		fixture_dir,
		"src/lib/from-sv.sv",
		[
			"<script>",
			`\tlet label: string = "from sv component";`,
			"</script>",
			"",
			"<p>{label}</p>",
			"",
		].join("\n"),
	);
}

async function write_text(root: string, path: string, content: string): Promise<void> {
	const file_path = join(root, path);

	await mkdir(dirname(file_path), { recursive: true });
	await writeFile(file_path, content);
}

async function run_vp(cwd: string, args: string[]): Promise<{ code: number; output: string }> {
	const result = await new Promise<{ code: number | null; output: string }>((resolve, reject) => {
		const child = spawn(vp_bin, args, {
			cwd,
			env: {
				...process.env,
				NODE_PATH: [join(cwd, "node_modules"), process.env.NODE_PATH]
					.filter(Boolean)
					.join(delimiter),
			},
			stdio: ["ignore", "pipe", "pipe"],
		});

		let output = "";

		child.stdout.on("data", (chunk: Buffer) => {
			output += chunk.toString();
		});

		child.stderr.on("data", (chunk: Buffer) => {
			output += chunk.toString();
		});

		child.on("error", reject);
		child.on("close", (code: number | null) => {
			resolve({ code, output });
		});
	});

	if (result.code !== 0) {
		throw new Error(`vp ${args.join(" ")} failed:\n${result.output}`);
	}

	return {
		code: result.code,
		output: result.output,
	};
}
