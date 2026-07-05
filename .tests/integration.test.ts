import { assertEquals, assertStringIncludes } from "@std/assert";
import { ensureDir } from "@std/fs";
import { dirname, fromFileUrl, join } from "@std/path";

const repo_root = dirname(fromFileUrl(import.meta.url));
const package_root = dirname(repo_root);

Deno.test("SvelteKit builds globally typed .svelte and .sv components", async () => {
  const fixture_dir = await Deno.makeTempDir({
    prefix: "svelte-global-typescript-",
  });

  try {
    await write_fixture(fixture_dir);

    const sync_result = await run_deno(fixture_dir, [
      "run",
      "-A",
      "npm:@sveltejs/kit@^2.0.0",
      "sync",
    ]);

    assertEquals(sync_result.code, 0, sync_result.output);

    const build_result = await run_deno(fixture_dir, [
      "run",
      "-A",
      "npm:vite@^8.0.0",
      "build",
    ]);

    assertEquals(build_result.code, 0, build_result.output);
    assertStringIncludes(build_result.output, "built");

    const root_html = await Deno.readTextFile(
      join(fixture_dir, "build", "index.html"),
    );

    assertStringIncludes(root_html, "Svelte route");
    assertStringIncludes(root_html, "from no-script markup");
    assertStringIncludes(root_html, "from sv component");
  } finally {
    await Deno.remove(fixture_dir, { recursive: true });
  }
});

async function write_fixture(fixture_dir: string): Promise<void> {
  const root_import = to_file_import(join(package_root, "src", "mod.js"));

  await write_text(
    fixture_dir,
    "package.json",
    JSON.stringify(
      {
        type: "module",
        private: true,
        dependencies: {
          "@jridgewell/sourcemap-codec": "^1.5.5",
          "@sveltejs/adapter-static": "^3.0.0",
          "@sveltejs/kit": "^2.0.0",
          "magic-string": "^0.30.21",
          "svelte": "^5.0.0",
          "vite": "^8.0.0",
        },
        devDependencies: {},
      },
      null,
      2,
    ) + "\n",
  );

  await write_text(
    fixture_dir,
    "deno.json",
    JSON.stringify(
      {
        imports: {
          "@jridgewell/sourcemap-codec":
            "npm:@jridgewell/sourcemap-codec@^1.5.5",
          "magic-string": "npm:magic-string@^0.30.21",
          "svelte-global-typescript": root_import,
        },
        nodeModulesDir: "auto",
      },
      null,
      2,
    ) + "\n",
  );

  await write_text(
    fixture_dir,
    "svelte.config.js",
    [
      'import adapter from "@sveltejs/adapter-static";',
      "",
      "export default {",
      '  extensions: [".svelte", ".sv"],',
      "  kit: {",
      "    adapter: adapter(),",
      "  },",
      "};",
      "",
    ].join("\n"),
  );

  await write_text(
    fixture_dir,
    "vite.config.ts",
    [
      'import { sveltekit } from "@sveltejs/kit/vite";',
      'import { defineConfig } from "vite";',
      'import { ts } from "svelte-global-typescript";',
      "",
      "export default defineConfig({",
      "  plugins: [ts(true), sveltekit()],",
      "});",
      "",
    ].join("\n"),
  );

  await write_text(
    fixture_dir,
    "tsconfig.json",
    JSON.stringify(
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
      2,
    ) + "\n",
  );

  await write_text(
    fixture_dir,
    "src/app.html",
    [
      "<!doctype html>",
      '<html lang="en">',
      "  <head>",
      '    <meta charset="utf-8" />',
      '    <meta name="viewport" content="width=device-width, initial-scale=1" />',
      "    %sveltekit.head%",
      "  </head>",
      "  <body>",
      "    <div>%sveltekit.body%</div>",
      "  </body>",
      "</html>",
      "",
    ].join("\n"),
  );

  await write_text(
    fixture_dir,
    "src/routes/+layout.ts",
    "export const prerender = true;\n",
  );

  await write_text(
    fixture_dir,
    "src/routes/+page.svelte",
    [
      "<script>",
      '  import NoScript from "$lib/no-script.svelte";',
      '  import FromSv from "$lib/from-sv.sv";',
      "",
      '  let title: string = "Svelte route";',
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
    '<p>{("from no-script markup" as string)}</p>\n',
  );

  await write_text(
    fixture_dir,
    "src/lib/from-sv.sv",
    [
      "<script>",
      '  let label: string = "from sv component";',
      "</script>",
      "",
      "<p>{label}</p>",
      "",
    ].join("\n"),
  );
}

async function write_text(
  root: string,
  path: string,
  content: string,
): Promise<void> {
  const file_path = join(root, path);

  await ensureDir(dirname(file_path));
  await Deno.writeTextFile(file_path, content);
}

async function run_deno(
  cwd: string,
  args: string[],
): Promise<{ code: number; output: string }> {
  const command = new Deno.Command(Deno.execPath(), {
    args,
    cwd,
    stdout: "piped",
    stderr: "piped",
  });

  const output = await command.output();
  const stdout = new TextDecoder().decode(output.stdout);
  const stderr = new TextDecoder().decode(output.stderr);

  return {
    code: output.code,
    output: `${stdout}${stderr}`,
  };
}

function to_file_import(path: string): string {
  return `file:///${path.replace(/\\/g, "/").replace(/^([A-Za-z]):/, "$1:")}`;
}
