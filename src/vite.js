import MagicString from "magic-string";

const component_extensions = [".svelte", ".sv"];
const script_tag_name = "<script";

/**
 * Creates a Vite plugin that treats Svelte component scripts as TypeScript by
 * default.
 *
 * @example
 * ```js
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
 * @param {boolean} [enabled] Whether the plugin should transform Svelte component files. Defaults to `true`.
 * @returns {import("vite").Plugin} A Vite plugin that runs before Svelte's compiler plugin.
 */
export function ts(enabled = true) {
  return {
    name: "svelte-global-typescript",
    enforce: "pre",

    transform(code, id) {
      if (!enabled || !is_component_request(id)) {
        return null;
      }

      return transform_component(code, id);
    },
  };
}

function transform_component(code, id) {
  const script_tags = find_script_open_tags(code);
  const magic = new MagicString(code);

  let changed = false;

  for (const script_tag of script_tags) {
    if (script_tag.has_lang) {
      continue;
    }

    magic.appendLeft(script_tag.insert_position, ' lang="ts"');
    changed = true;
  }

  if (script_tags.length === 0) {
    magic.prepend('<script lang="ts"></script>\n');
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

function make_source_map(magic, id, code) {
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

function is_component_request(id) {
  if (id.includes("?")) {
    return false;
  }

  return component_extensions.some((extension) => id.endsWith(extension));
}

function find_script_open_tags(source) {
  const lower_source = source.toLowerCase();
  const tags = [];

  let index = 0;

  while (index < source.length) {
    const comment_start = lower_source.indexOf("<!--", index);
    const script_start = find_next_script_start(lower_source, index);

    if (script_start === -1) {
      break;
    }

    if (comment_start !== -1 && comment_start < script_start) {
      const comment_end = lower_source.indexOf("-->", comment_start + 4);

      index = comment_end === -1 ? source.length : comment_end + 3;
      continue;
    }

    const tag_end = find_tag_end(source, script_start);

    if (tag_end === -1) {
      break;
    }

    const tag = source.slice(script_start, tag_end + 1);

    tags.push({
      has_lang: tag_has_lang_attribute(tag),
      insert_position: script_start + script_tag_name.length,
    });

    index = tag_end + 1;
  }

  return tags;
}

function find_next_script_start(lower_source, start) {
  let index = start;

  while (index < lower_source.length) {
    const script_start = lower_source.indexOf(script_tag_name, index);

    if (script_start === -1) {
      return -1;
    }

    const boundary = lower_source[script_start + script_tag_name.length];

    if (is_tag_name_boundary(boundary)) {
      return script_start;
    }

    index = script_start + script_tag_name.length;
  }

  return -1;
}

function find_tag_end(source, start) {
  let quote;

  for (let index = start; index < source.length; index += 1) {
    const char = source[index];

    if (quote) {
      if (char === quote) {
        quote = undefined;
      }

      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (char === ">") {
      return index;
    }
  }

  return -1;
}

function tag_has_lang_attribute(tag) {
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

function skip_attribute_value(tag, start) {
  let index = skip_whitespace(tag, start);
  const quote = tag[index];

  if (quote === '"' || quote === "'") {
    index += 1;

    while (index < tag.length && tag[index] !== quote) {
      index += 1;
    }

    return index + 1;
  }

  while (!is_unquoted_attribute_value_boundary(tag[index])) {
    index += 1;
  }

  return index;
}

function skip_whitespace(value, start) {
  let index = start;

  while (index < value.length && is_whitespace(value[index])) {
    index += 1;
  }

  return index;
}

function is_tag_name_boundary(value) {
  return value === undefined || value === ">" || value === "/" ||
    is_whitespace(value);
}

function is_attribute_name_boundary(value) {
  return value === undefined || value === "=" || value === ">" ||
    value === "/" || is_whitespace(value);
}

function is_unquoted_attribute_value_boundary(value) {
  return value === undefined || value === ">" || is_whitespace(value);
}

function is_whitespace(value) {
  return value !== undefined && /\s/.test(value);
}
