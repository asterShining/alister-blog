import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { postSchema, momentSchema, specSchema, seriesSchema } from "shirones/collections";

/**
 * Shirone content collections — inline schemas for full type safety and Astro
 * typegen support (a schema hidden behind a helper call cannot be
 * introspected). Edit the `base` paths if you moved the content directory;
 * the schemas themselves come from the theme.
 *
 * Generated from the theme's `src/integration/collections.manifest.json`.
 */
const posts = defineCollection({
	loader: glob({ base: "./shirones/content/posts", pattern: "**/*.{md,mdx}" }),
	schema: postSchema,
});

const moments = defineCollection({
	loader: glob({ base: "./shirones/content/moments", pattern: "**/*.md" }),
	schema: momentSchema,
});

const spec = defineCollection({
	loader: glob({ base: "./shirones/content/spec", pattern: "**/*.{md,mdx}" }),
	schema: specSchema,
});

const seriesGlob = glob({
	base: "./shirones/content/series",
	pattern: "**/*.md",
});

type SeriesLoaderLogger = Parameters<typeof seriesGlob.load>[0]["logger"];

/**
 * Series is off (`shirones/config/seriesConfig.ts` → `enable: false`) and
 * `shirones/content/series/` stays empty until it is turned back on, so Astro's
 * glob loader warning "No files found matching …" is expected noise on every
 * sync. Drop exactly that notice; anything else (missing base directory, bad
 * frontmatter, unreadable file) still surfaces. The loader stays a plain glob,
 * so re-enabling Series needs no change here beyond adding content.
 */
function quietEmptyPatternNotice(logger: SeriesLoaderLogger): SeriesLoaderLogger {
	const notice = "No files found matching";
	return new Proxy(logger, {
		get(target, property, receiver) {
			const value: unknown = Reflect.get(target, property, receiver);
			if (property !== "warn" || typeof value !== "function") {
				return typeof value === "function" ? value.bind(target) : value;
			}
			const warn = value as (message: string) => void;
			return (message: string) => {
				if (!message.startsWith(notice)) warn.call(target, message);
			};
		},
	});
}

const series = defineCollection({
	loader: {
		name: "series-glob",
		load: (context: Parameters<typeof seriesGlob.load>[0]) =>
			seriesGlob.load({
				...context,
				logger: quietEmptyPatternNotice(context.logger),
			}),
	},
	schema: seriesSchema,
});

export const collections = { posts, moments, spec, series } as const;
