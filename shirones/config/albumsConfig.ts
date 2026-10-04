import type { AlbumsConfig } from "@/types/albumsConfig.ts";
import { withUserConfig } from "@/utils/config-overlay.ts";

export const albumsConfig: AlbumsConfig = withUserConfig("albums", {
	// Re-enable after adding real albums; disabled pages stay out of navigation and sitemap.
	enable: false,
	title: "$t:albums",
	description: "$t:albumsBanner",
});
