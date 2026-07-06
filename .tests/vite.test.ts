import { ts } from "../src/mod";
import type { TransformResult } from "vite";
import { describe, expect, test } from "vitest";

type TransformHook = (code: string, id: string) => TransformResult | Promise<TransformResult>;

describe("ts", () => {
	test("adds lang ts to plain instance scripts", async () => {
		const code = `<script>let name: string = "world";</script>\n<h1>{name}</h1>`;
		const transformed = await transform_code(code, "src/routes/+page.svelte");

		expect(transformed).toBe(
			`<script lang="ts">let name: string = "world";</script>\n<h1>{name}</h1>`,
		);
	});

	test("adds lang ts to module scripts", async () => {
		const code = "<script module>export const prerender: boolean = true;</script>";
		const transformed = await transform_code(code, "src/routes/+layout.svelte");

		expect(transformed).toBe(
			`<script lang="ts" module>export const prerender: boolean = true;</script>`,
		);
	});

	test("leaves existing lang ts scripts alone", async () => {
		const code = `<script lang="ts">let name: string = "world";</script>`;
		const transformed = await transform_code(code, "src/lib/component.svelte");

		expect(transformed).toBeNull();
	});

	test("preserves explicit non-ts script languages", async () => {
		const code = `<script lang="js">let name = "world";</script>`;
		const transformed = await transform_code(code, "src/lib/component.svelte");

		expect(transformed).toBeNull();
	});

	test("prepends an empty ts script for no-script components", async () => {
		const code = "<p>{value as string}</p>";
		const transformed = await transform_code(code, "src/lib/component.svelte");

		expect(transformed).toBe(`<script lang="ts"></script>\n<p>{value as string}</p>`);
	});

	test("transforms sv components", async () => {
		const code = "<script>let count: number = 1;</script>\n<p>{count}</p>";
		const transformed = await transform_code(code, "src/lib/counter.sv");

		expect(transformed).toBe(
			`<script lang="ts">let count: number = 1;</script>\n<p>{count}</p>`,
		);
	});

	test("ignores script tags inside comments", async () => {
		const code = "<!-- <script>let ignored: number = 1;</script> -->\n<p>ok</p>";
		const transformed = await transform_code(code, "src/lib/commented.svelte");

		expect(transformed).toBe(
			`<script lang="ts"></script>\n<!-- <script>let ignored: number = 1;</script> -->\n<p>ok</p>`,
		);
	});

	test("keeps scanning through quoted tag delimiters", async () => {
		const code = `<script data-expression="1 > 0">let count: number = 1;</script>`;
		const transformed = await transform_code(code, "src/lib/quoted.svelte");

		expect(transformed).toBe(
			`<script lang="ts" data-expression="1 > 0">let count: number = 1;</script>`,
		);
	});

	test("does not treat script-like tag names as scripts", async () => {
		const code = "<scripted>not a script tag</scripted>";
		const transformed = await transform_code(code, "src/lib/scripted.svelte");

		expect(transformed).toBe(
			`<script lang="ts"></script>\n<scripted>not a script tag</scripted>`,
		);
	});

	test("ignores non-component files and query requests", async () => {
		const code = "<script>let count: number = 1;</script>";

		expect(await transform_code(code, "src/lib/counter.ts")).toBeNull();
		expect(await transform_code(code, "src/lib/counter.svelte?raw")).toBeNull();
	});

	test("false returns no transform output", async () => {
		const code = "<p>{value as string}</p>";
		const transformed = await transform_code(code, "src/lib/component.svelte", false);

		expect(transformed).toBeNull();
	});

	test("can run as a Svelte markup preprocessor", () => {
		const code = "<script>let count: number = 1;</script>\n<p>{count}</p>";
		const transformed = preprocess_code(code, "src/lib/counter.svelte");

		expect(transformed).toBe(
			`<script lang="ts">let count: number = 1;</script>\n<p>{count}</p>`,
		);
	});

	test("markup preprocessor handles no filename", () => {
		const code = "<p>{value as string}</p>";
		const transformed = preprocess_code(code);

		expect(transformed).toBe(`<script lang="ts"></script>\n<p>{value as string}</p>`);
	});

	test("false has no markup preprocessor", () => {
		const plugin = ts(false);

		expect(plugin.markup).toBeUndefined();
	});
});

async function transform_code(code: string, id: string, enabled = true): Promise<string | null> {
	const plugin = ts(enabled);
	const transform = plugin.transform as TransformHook | undefined;

	expect(transform).toBeDefined();

	const result = await transform?.(code, id);

	if (!result) {
		return null;
	}

	if (typeof result === "string") {
		return result;
	}

	return result.code;
}

function preprocess_code(code: string, filename?: string): string | null {
	const plugin = ts();
	const result = plugin.markup?.({ content: code, filename });

	if (!result) {
		return null;
	}

	if (typeof result === "string") {
		return result;
	}

	return result.code;
}
