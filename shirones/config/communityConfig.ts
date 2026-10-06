import { withUserConfig } from "@/utils/config-overlay.ts";

export interface CommunityConfig {
	enable: boolean;
	title: string;
	description: string;
}

/**
 * 构建期开关。
 *
 * SSR 与客户端 island（移动端导航抽屉、Community 应用）共用这一份配置模块，
 * 而浏览器里没有 `process.env`：只读 `process.env.COMMUNITY_ENABLE` 会让客户端
 * 静默退回 `enable: false`，表现成「SSR 里抽屉有轨迹入口、hydration 后入口消失」。
 * 因此构建时由 `astro.config.mjs` 的 Vite `define` 把同一个构建值内联进两端。
 */
declare const __COMMUNITY_ENABLE__: boolean | undefined;

const envEnable =
	(typeof process !== "undefined" &&
		(process.env.COMMUNITY_ENABLE === "true" ||
			process.env.COMMUNITY_ENABLE === "1")) ||
	(typeof __COMMUNITY_ENABLE__ !== "undefined" && __COMMUNITY_ENABLE__ === true);

export const communityConfig: CommunityConfig = withUserConfig("community", {
	enable: envEnable ? true : false,
	title: "轨迹",
	description: "记录一些不一定需要写成长文章，但又想留下来的东西。",
});
