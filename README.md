<h1 align="center">svelte-global-typescript</h1>

<p align="center">
  <a href="https://www.npmjs.com/package/svelte-global-typescript">npm</a>
  •
  <a href="https://docs.barekey.dev/global-typescript">docs</a>
</p>

---

Write TypeScript in Svelte without repeating `lang="ts"`.

```svelte
<script>
  let count: number = $state(0);
</script>

<button onclick={() => count += 1}>
  Clicked {count} times
</button>
```

`ts()` runs as a Vite plugin for builds and as a Svelte markup preprocessor for editor tooling. It adds TypeScript mode to unlabeled scripts and markup-only components, preserves explicit language attributes, and also transforms `.sv` files when that extension is enabled separately. Syntax that emits runtime JavaScript still needs a later TypeScript preprocessor.

Visit the **[docs](https://docs.barekey.dev/global-typescript)** for installation, build and editor configuration, composer setup, `.sv` support, limits, and API reference.
