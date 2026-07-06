export default {
	fmt: {
		ignorePatterns: [".dist/**", "dist/**", "node_modules/**"],
		tabWidth: 4,
		useTabs: true,
	},
	lint: {
		ignorePatterns: [".dist/**", "dist/**", "node_modules/**"],
		options: { typeAware: true, typeCheck: true },
	},
	pack: {
		dts: { oxc: true },
		entry: ["src/mod.ts", "src/vite.ts"],
		format: ["esm"],
		outDir: ".dist",
		sourcemap: true,
	},
};
