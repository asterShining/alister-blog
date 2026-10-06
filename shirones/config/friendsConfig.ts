import type { FriendsConfig } from "@/types/friendsConfig.ts";
import { withUserConfig } from "@/utils/config-overlay.ts";

export const friendsConfig: FriendsConfig = withUserConfig("friends", {
	enable: true,
	title: "$t:friends",
	description: "这里收录一些朋友的博客，欢迎去看看。",
});
