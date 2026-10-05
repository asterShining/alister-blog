import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";

// Production origin is configured in shirones/config/siteConfig.ts. Update this
// contract if the blog's permanent domain changes.
const productionOrigin = "https://alistereno.top";
const oldThemeOrigin = "shirone.mysqil.com";

function originOf(url: string): string {
	return new URL(url).origin;
}

function xmlLocations(xml: string): string[] {
	return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
}

test("@production sitemap, robots and feeds use the permanent domain", async ({ request }) => {
	const indexResponse = await request.get("/sitemap-index.xml");
	expect(indexResponse.ok()).toBeTruthy();
	const sitemapUrls = xmlLocations(await indexResponse.text());
	expect(sitemapUrls.length).toBeGreaterThan(0);
	for (const sitemapUrl of sitemapUrls) {
		expect(originOf(sitemapUrl)).toBe(productionOrigin);
		const sitemapResponse = await request.get(new URL(sitemapUrl).pathname);
		expect(sitemapResponse.ok()).toBeTruthy();
		const pageUrls = xmlLocations(await sitemapResponse.text());
		expect(pageUrls.length).toBeGreaterThan(0);
		for (const pageUrl of pageUrls) expect(originOf(pageUrl)).toBe(productionOrigin);
	}

	const robotsResponse = await request.get("/robots.txt");
	expect(robotsResponse.ok()).toBeTruthy();
	expect(await robotsResponse.text()).toContain(`Sitemap: ${productionOrigin}/sitemap-index.xml`);

	for (const feed of ["rss.xml", "atom.xml"]) {
		const response = await request.get(`/${feed}`);
		expect(response.ok()).toBeTruthy();
		const xml = await response.text();
		const feedUrls = feed === "rss.xml"
			? [...xml.matchAll(/<link>([^<]+)<\/link>/g)].map((match) => match[1])
			: [
				...[...xml.matchAll(/<link\b[^>]*href="([^"]+)"/g)].map((match) => match[1]),
				...[...xml.matchAll(/<id>([^<]+)<\/id>/g)].map((match) => match[1]),
			];
		expect(feedUrls.length, `${feed} should contain feed and post URLs`).toBeGreaterThan(0);
		for (const url of feedUrls) expect(originOf(url)).toBe(productionOrigin);
		expect(xml).not.toContain(oldThemeOrigin);
	}
});

test("@production HTML metadata uses the permanent domain", async ({ request }) => {
	for (const route of ["/", "/posts/hello-alister-blog/"]) {
		const response = await request.get(route);
		expect(response.ok()).toBeTruthy();
		const html = await response.text();
		for (const property of ["og:url", "twitter:url"]) {
			const meta = html.match(new RegExp(`<meta\\s+property="${property}"\\s+content="([^"]+)"`, "i"));
			expect(meta, `${route} must expose ${property}`).not.toBeNull();
			expect(originOf(meta![1])).toBe(productionOrigin);
		}
		const canonicalLink = [...html.matchAll(/<link\b[^>]*>/gi)]
			.map(([tag]) => tag)
			.find((tag) => /\brel="canonical"/i.test(tag));
		if (canonicalLink) {
			const href = canonicalLink.match(/\bhref="([^"]+)"/i);
			expect(href, `${route} canonical link needs href`).not.toBeNull();
			expect(originOf(href![1])).toBe(productionOrigin);
		}
	}
});

test("@production built text files contain no Shirone example origin", async () => {
	const dist = path.resolve("dist");
	const textExtensions = new Set([".html", ".xml", ".txt", ".json"]);
	const visit = async (directory: string): Promise<void> => {
		for (const entry of await readdir(directory, { withFileTypes: true })) {
			const file = path.join(directory, entry.name);
			if (entry.isDirectory()) await visit(file);
			else if (entry.isFile() && textExtensions.has(path.extname(file))) {
				expect(await readFile(file, "utf8"), file).not.toContain(oldThemeOrigin);
			}
		}
	};
	await visit(dist);
});
