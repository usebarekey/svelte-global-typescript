import type { Plugin, TransformResult } from "vite";

import MagicString from "magic-string";

const component_extensions = [".svelte", ".sv"] as const;
const composer_config_key = "__svelte_plugin_composer_config";
const double_quote_character = String.fromCharCode(34);
const script_tag_name = "<script";
const single_quote_character = String.fromCharCode(39);
const typescript_lang_attribute = ` lang=${double_quote_character}ts${double_quote_character}`;
const empty_typescript_script = `<script lang=${double_quote_character}ts${double_quote_character}></script>\n`;

type SearchResult =
	| {
			readonly _tag: "found";
			readonly index: number;
	  }
	| {
			readonly _tag: "missing";
	  };

type CommentScanResult =
	| {
			readonly _tag: "found";
			readonly next_index: number;
	  }
	| {
			readonly _tag: "missing";
	  };

interface ScriptOpenTag {
	has_lang: boolean;
	insert_position: number;
}

interface MarkupPreprocessOptions {
	content: string;
	filename?: string;
}

type MarkupPreprocessResult = TransformResult | undefined;

interface SvelteMarkupPreprocessor {
	name?: string;
	markup(options: MarkupPreprocessOptions): MarkupPreprocessResult;
}

interface ComposerConfigContribution {
	readonly source: string;
	readonly config: Record<string, unknown>;
}

/**
 * Vite plugin that can also be used as a Svelte markup preprocessor.
 *
 * @example
 * ```ts
 * export default {
 *   preprocess: [ts()],
 * };
 * ```
 *
 * @since 0.1.0
 */
export type GlobalTypescriptPlugin = Plugin &
	Partial<SvelteMarkupPreprocessor> & {
		readonly [composer_config_key]?: ComposerConfigContribution;
	};

/**
 * Creates a Vite plugin that treats Svelte component scripts as TypeScript by
 * default. The returned object can also be used as a Svelte markup preprocessor
 * so editor tooling can see the same rewrite before parsing.
 *
 * @example
 * ```ts
 * import { sveltekit } from "@sveltejs/kit/vite";
 * import { defineConfig } from "vite";
 * import { ts } from "svelte-global-typescript";
 *
 * export default defineConfig({
 *   plugins: [ts(true), sveltekit()],
 * });
 * ```
 *
 * @since 0.1.0
 * @param enabled - Whether the plugin should transform Svelte component files.
 *   Defaults to `true`.
 * @returns A Vite plugin and Svelte markup preprocessor.
 */
export function ts(enabled = true): GlobalTypescriptPlugin {
	const preprocessor = make_preprocessor(enabled);
	const plugin: GlobalTypescriptPlugin = {
		name: "svelte-global-typescript",

		transform(code, id) {
			if (!enabled || !is_component_request(id)) {
				return null;
			}

			return transform_component(code, id);
		},
	};

	if (!enabled) {
		return plugin;
	}

	plugin.markup = (options) => preprocessor.markup(options);
	Object.defineProperty(plugin, composer_config_key, {
		enumerable: false,
		value: {
			source: "svelte-global-typescript",
			config: {
				preprocess: [preprocessor],
			},
		},
	});

	return plugin;
}

function transform_component(code: string, id: string): TransformResult | null {
	const script_tags = find_script_open_tags(code);
	const magic = new MagicString(code);

	let changed = false;

	for (const script_tag of script_tags) {
		if (script_tag.has_lang) {
			continue;
		}

		magic.appendLeft(script_tag.insert_position, typescript_lang_attribute);
		changed = true;
	}

	if (script_tags.length === 0) {
		magic.prepend(empty_typescript_script);
		changed = true;
	}

	if (!changed) {
		return null;
	}

	return {
		code: magic.toString(),
		map: make_source_map(magic, id, code),
	};
}

function make_preprocessor(enabled: boolean): SvelteMarkupPreprocessor {
	return {
		name: "svelte-global-typescript",
		markup: ({ content, filename }: MarkupPreprocessOptions) => {
			if (!enabled || !is_component_filename(filename)) {
				return undefined;
			}

			return transform_component(content, filename ?? "component.svelte") ?? undefined;
		},
	};
}

function make_source_map(
	magic: MagicString,
	id: string,
	code: string,
): NonNullable<TransformResult["map"]> {
	const map = magic.generateMap({
		hires: true,
		includeContent: true,
		source: id,
	});

	return {
		file: map.file,
		mappings: map.mappings,
		names: map.names,
		sources: map.sources,
		sourcesContent: map.sourcesContent ?? [code],
		version: map.version,
		x_google_ignoreList: map.x_google_ignoreList,
		debugId: map.debugId,
		toString: () => map.toString(),
		toUrl: () => map.toUrl(),
	};
}

function is_component_request(id: string): boolean {
	if (id.includes("?")) {
		return false;
	}

	return is_component_filename(id);
}

function is_component_filename(filename: string | undefined): boolean {
	if (!filename) {
		return true;
	}

	return component_extensions.some((extension) => filename.endsWith(extension));
}

function find_script_open_tags(source: string): ScriptOpenTag[] {
	const lower_source = source.toLowerCase();
	const tags: ScriptOpenTag[] = [];

	let index = 0;

	while (index < source.length) {
		const script_start = find_next_script_start(lower_source, index);

		if (script_start._tag === "missing") {
			break;
		}

		const comment = find_comment_before(lower_source, index, script_start.index);

		if (comment._tag === "found") {
			index = comment.next_index;
			continue;
		}

		const tag_end = find_tag_end(source, script_start.index);

		if (tag_end._tag === "missing") {
			break;
		}

		const tag = source.slice(script_start.index, tag_end.index + 1);

		tags.push({
			has_lang: tag_has_lang_attribute(tag),
			insert_position: script_start.index + script_tag_name.length,
		});

		index = tag_end.index + 1;
	}

	return tags;
}

function find_comment_before(
	lower_source: string,
	start: number,
	before: number,
): CommentScanResult {
	const comment_start = lower_source.indexOf("<!--", start);

	if (comment_start === -1 || comment_start >= before) {
		return { _tag: "missing" };
	}

	const comment_end = lower_source.indexOf("-->", comment_start + 4);
	const next_index = comment_end === -1 ? lower_source.length : comment_end + 3;

	return {
		_tag: "found",
		next_index,
	};
}

function find_next_script_start(lower_source: string, start: number): SearchResult {
	let index = start;

	while (index < lower_source.length) {
		const script_start = lower_source.indexOf(script_tag_name, index);

		if (script_start === -1) {
			return { _tag: "missing" };
		}

		const boundary = lower_source[script_start + script_tag_name.length];

		if (is_tag_name_boundary(boundary)) {
			return {
				_tag: "found",
				index: script_start,
			};
		}

		index = script_start + script_tag_name.length;
	}

	return { _tag: "missing" };
}

function find_tag_end(source: string, start: number): SearchResult {
	let quote: string | undefined;

	for (let index = start; index < source.length; index += 1) {
		const char = source[index];

		if (quote) {
			if (char === quote) {
				quote = undefined;
			}

			continue;
		}

		if (char === double_quote_character || char === single_quote_character) {
			quote = char;
			continue;
		}

		if (char === ">") {
			return {
				_tag: "found",
				index,
			};
		}
	}

	return { _tag: "missing" };
}

function tag_has_lang_attribute(tag: string): boolean {
	let index = script_tag_name.length;

	while (index < tag.length) {
		index = skip_whitespace(tag, index);

		const char = tag[index];

		if (char === undefined || char === ">" || char === "/") {
			return false;
		}

		const name_start = index;

		while (!is_attribute_name_boundary(tag[index])) {
			index += 1;
		}

		if (name_start === index) {
			index += 1;
			continue;
		}

		const name = tag.slice(name_start, index).toLowerCase();

		if (name === "lang") {
			return true;
		}

		index = skip_whitespace(tag, index);

		if (tag[index] !== "=") {
			continue;
		}

		index = skip_attribute_value(tag, index + 1);
	}

	return false;
}

function skip_attribute_value(tag: string, start: number): number {
	let index = skip_whitespace(tag, start);
	const quote = tag[index];

	if (quote === double_quote_character || quote === single_quote_character) {
		index += 1;

		while (index < tag.length && tag[index] !== quote) {
			index += 1;
		}

		return index < tag.length ? index + 1 : index;
	}

	while (!is_unquoted_attribute_value_boundary(tag[index])) {
		index += 1;
	}

	return index;
}

function skip_whitespace(value: string, start: number): number {
	let index = start;

	while (index < value.length && is_whitespace(value[index])) {
		index += 1;
	}

	return index;
}

function is_tag_name_boundary(value: string | undefined): boolean {
	return value === undefined || value === ">" || value === "/" || is_whitespace(value);
}

function is_attribute_name_boundary(value: string | undefined): boolean {
	return (
		value === undefined ||
		value === "=" ||
		value === ">" ||
		value === "/" ||
		is_whitespace(value)
	);
}

function is_unquoted_attribute_value_boundary(value: string | undefined): boolean {
	return value === undefined || value === ">" || is_whitespace(value);
}

function is_whitespace(value: string | undefined): boolean {
	return value !== undefined && /\s/.test(value);
}
