/**
 * Next.js config for @essai/web.
 *
 * NOTE: This file is `.mjs` rather than `.ts` because the workspace pins
 * TypeScript 7.0.2 (ESM-only, `"type": "module"`), whose `require()`
 * surface does not expose `ts.sys` / `ts.findConfigFile`. Next.js 15.x
 * loads `next.config.ts` via those APIs and therefore fails with
 * `Cannot read properties of undefined (reading 'fileExists')`. The
 * `.mjs` form is functionally equivalent and loads without that path.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const config = {
	reactStrictMode: true,
	transpilePackages: ["@essai/core"],
	env: {
		ESSAI_PROJECT_DIR: process.env.ESSAI_PROJECT_DIR ?? "",
	},
	webpack: (wc) => {
		wc.resolve = wc.resolve ?? {};
		wc.resolve.alias = {
			...(wc.resolve.alias ?? {}),
			"@": path.resolve(__dirname, "src"),
		};
		wc.resolve.extensionAlias = {
			".js": [".ts", ".tsx", ".js"],
			".mjs": [".mts", ".mjs"],
		};
		return wc;
	},
};

export default config;
