import { assertEquals, assertExists } from "@std/assert";
import { ts } from "../src/mod.ts";
import type { TransformResult } from "vite";

type TransformHook = (
  code: string,
  id: string,
) => TransformResult | Promise<TransformResult>;

Deno.test("ts adds lang ts to plain instance scripts", async () => {
  const code = '<script>let name: string = "world";</script>\n<h1>{name}</h1>';
  const transformed = await transform_code(code, "src/routes/+page.svelte");

  assertEquals(
    transformed,
    '<script lang="ts">let name: string = "world";</script>\n<h1>{name}</h1>',
  );
});

Deno.test("ts adds lang ts to module scripts", async () => {
  const code =
    "<script module>export const prerender: boolean = true;</script>";
  const transformed = await transform_code(code, "src/routes/+layout.svelte");

  assertEquals(
    transformed,
    '<script lang="ts" module>export const prerender: boolean = true;</script>',
  );
});

Deno.test("ts leaves existing lang ts scripts alone", async () => {
  const code = '<script lang="ts">let name: string = "world";</script>';
  const transformed = await transform_code(code, "src/lib/component.svelte");

  assertEquals(transformed, null);
});

Deno.test("ts preserves explicit non-ts script languages", async () => {
  const code = '<script lang="js">let name = "world";</script>';
  const transformed = await transform_code(code, "src/lib/component.svelte");

  assertEquals(transformed, null);
});

Deno.test("ts prepends an empty ts script for no-script components", async () => {
  const code = "<p>{value as string}</p>";
  const transformed = await transform_code(code, "src/lib/component.svelte");

  assertEquals(
    transformed,
    '<script lang="ts"></script>\n<p>{value as string}</p>',
  );
});

Deno.test("ts transforms sv components", async () => {
  const code = "<script>let count: number = 1;</script>\n<p>{count}</p>";
  const transformed = await transform_code(code, "src/lib/counter.sv");

  assertEquals(
    transformed,
    '<script lang="ts">let count: number = 1;</script>\n<p>{count}</p>',
  );
});

Deno.test("ts ignores non-component files and query requests", async () => {
  const code = "<script>let count: number = 1;</script>";

  assertEquals(await transform_code(code, "src/lib/counter.ts"), null);
  assertEquals(await transform_code(code, "src/lib/counter.svelte?raw"), null);
});

Deno.test("ts false returns no transform output", async () => {
  const code = "<p>{value as string}</p>";
  const transformed = await transform_code(
    code,
    "src/lib/component.svelte",
    false,
  );

  assertEquals(transformed, null);
});

async function transform_code(
  code: string,
  id: string,
  enabled = true,
): Promise<string | null> {
  const plugin = ts(enabled);
  const transform = plugin.transform as TransformHook | undefined;

  assertExists(transform);

  const result = await transform(code, id);

  if (!result) {
    return null;
  }

  if (typeof result === "string") {
    return result;
  }

  return result.code;
}
