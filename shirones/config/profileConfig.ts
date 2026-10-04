import type { ProfileConfig } from "@/types/config";
import { withUserConfig } from "@/utils/config-overlay.ts";

/**
 * 博主资料：头像 / 名称 / 简介 / 社交链接（侧栏 Profile 卡片、页脚、RSS 作者等消费）。
 * 类型见 src/types/config.ts。
 */
export const profileConfig: ProfileConfig = withUserConfig("profile", {
	avatar: "/images/themes/starry/avatar.webp", // Relative to public when the path starts with '/'
	name: "Alister",
	bio: "代码、幻想与日常。",
	// Add personal accounts here when their URLs are ready.
	links: [],
});
