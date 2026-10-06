import { withUserConfig } from "@/utils/config-overlay.ts";

export interface CommunityConfig {
	enable: boolean;
	title: string;
	description: string;
}

const envEnable =
	typeof process !== "undefined" &&
	(process.env.COMMUNITY_ENABLE === "true" ||
		process.env.COMMUNITY_ENABLE === "1");

export const communityConfig: CommunityConfig = withUserConfig("community", {
	enable: envEnable ? true : false,
	title: "社区",
	description: "记录一些不一定需要写成长文章，但又想留下来的东西。",
});
