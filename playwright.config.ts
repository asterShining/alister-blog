import { defineConfig } from "@playwright/test";

const previewUrl = "http://127.0.0.1:4321";

export default defineConfig({
	testDir: "./tests/e2e",
	fullyParallel: false,
	forbidOnly: Boolean(process.env.CI),
	retries: process.env.CI ? 1 : 0,
	workers: process.env.CI ? 1 : undefined,
	reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
	use: {
		baseURL: previewUrl,
		trace: "retain-on-failure",
		screenshot: "only-on-failure",
	},
	webServer: {
		command: "node ./node_modules/astro/bin/astro.mjs preview --host 127.0.0.1 --port 4321",
		// Astro 7 otherwise auto-backgrounds in agent environments. Playwright
		// needs a foreground child it can stop after the tests.
		env: { ASTRO_PREVIEW_BACKGROUND: "1" },
		gracefulShutdown: { signal: "SIGINT", timeout: 5_000 },
		url: previewUrl,
		reuseExistingServer: false,
		timeout: 120_000,
	},
});
