import type { FriendsConfig } from "@/types/friendsConfig.ts";
import { withUserConfig } from "@/utils/config-overlay.ts";

export const friendsConfig: FriendsConfig = withUserConfig("friends", {
	enable: true,
	title: "$t:friends",
	description: "友链正在整理中，欢迎稍后再来看看。",
});
