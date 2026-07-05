# svelte-global-typescript

Use TypeScript in Svelte components without writing `lang="ts"` everywhere.

`svelte-global-typescript` is a tiny Vite plugin. Put it before SvelteKit's Vite
plugin, and ordinary `.svelte` files are compiled as if their script tags had
`lang="ts"` by default.

It also supports `.sv` files, so it works neatly with `svelte-sv-extension`.

## Install

```sh
npm install -D svelte-global-typescript
```

## Setup

Add the plugin to `vite.config.ts` before `sveltekit()`:

```ts
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";
import { ts } from "svelte-global-typescript";

export default defineConfig({
  plugins: [ts(true), sveltekit()],
});
```

`ts()` is the same as `ts(true)`. Use `ts(false)` when you want to keep the
plugin installed but temporarily disabled.

The plugin is also available from its area export:

```ts
import { ts } from "svelte-global-typescript/vite";
```

### With `svelte-plugin-composer`

When using `svelte-plugin-composer`, add `ts()` before `kit(...)`:

```ts
import adapter from "@sveltejs/adapter-auto";
import { ts } from "svelte-global-typescript";
import { compose, kit } from "svelte-plugin-composer";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: compose([
    ts(),
    kit({ adapter: adapter() }),
  ]),
});
```

The composer may strip the plugin's `pre` priority, but it preserves the order
you wrote, so `ts()` still runs before SvelteKit in the final plugin list.

## What It Does

These components compile with TypeScript mode enabled:

```svelte
<script>
  let name: string = "world";
</script>

<h1>{name}</h1>
```

```svelte
<p>{value as string}</p>
```

Under the hood, the plugin adds `lang="ts"` to Svelte script tags that do not
already have a `lang` attribute. If a component has no script tag, it adds an
empty TypeScript script so TS-only markup expressions work too.

Explicit language attributes are preserved:

```svelte
<script lang="js">
  let name = "world";
</script>
```

That gives each file an escape hatch.

## Limits

This enables Svelte's built-in TypeScript support, which covers type-only syntax
such as annotations, interfaces, casts, and typed props.

TypeScript features that emit runtime JavaScript, such as enums, still need the
usual Svelte preprocessing setup:

```ts
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

export default {
  preprocess: vitePreprocess({ script: true }),
};
```

This is also a build-time transform, not an editor transform. The Svelte
language server reads your source file before Vite plugins run, so editor
diagnostics may still expect explicit `<script lang="ts">` in files with
TypeScript syntax. Keep `lang="ts"` where editor feedback matters, or pair this
with a future editor integration that teaches the language server the same
default.

## `.sv` Files

The plugin transforms `.svelte` and `.sv` files. To make SvelteKit discover
`.sv` route components, configure Svelte's extensions separately:

```js
export default {
  extensions: [".svelte", ".sv"],
};
```
