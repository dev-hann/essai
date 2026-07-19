import type { Config } from "tailwindcss";

const config: Config = {
	darkMode: "class",
	content: [
		"./src/app/**/*.{ts,tsx}",
		"./src/components/**/*.{ts,tsx}",
		"./src/**/*.{ts,tsx}",
	],
	theme: {
		extend: {
			fontFamily: {
				sans: [
					"Pretendard",
					"-apple-system",
					"BlinkMacSystemFont",
					"system-ui",
					"sans-serif",
				],
			},
		},
	},
	plugins: [],
};

export default config;
