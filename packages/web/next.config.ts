import type { NextConfig } from "next";

const config: NextConfig = {
	transpilePackages: ["@essai/core"],
	webpack: (wc) => {
		wc.resolve.extensionAlias = {
			".js": [".ts", ".tsx", ".js"],
			".mjs": [".mts", ".mjs"],
		};
		return wc;
	},
};

export default config;
