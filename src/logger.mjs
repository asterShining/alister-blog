/**
 * Astro 日志目的地（由 `astro.config.mjs` 的 `logger.entrypoint` 加载）。
 *
 * 背景：本仓库不使用 Series（`shirones/config/seriesConfig.ts` → `enable: false`，
 * `shirones/content/series/` 保持为空，schema 与 collection 定义保留以便日后启用）。
 * 但 shirones 0.1.5 的 `src/utils/content-utils.ts` → `getSeriesCatalog()` 不受
 * `enable` 控制，每次取文章列表都会 `getCollection("series")`，于是空集合在每次渲染时
 * 反复输出 `The collection "series" does not exist or is empty.`。
 *
 * 这里只丢弃这一条针对 series 的「空集合」提示，其余日志原样转发给 Astro 默认的
 * console 目的地（格式、级别、流向都不变）。若日后启用 Series 并放入内容，
 * 该过滤自动失效（不再有这条消息）。
 */
import consoleDestination from "astro/logger/console";

const SILENCED_MESSAGES = [
	/^The collection "series" does not exist or is empty\./,
];

export default function alisterLogger(config = {}) {
	const destination = consoleDestination(config);
	return {
		write(event) {
			if (SILENCED_MESSAGES.some((pattern) => pattern.test(event.message))) {
				return;
			}
			destination.write(event);
		},
	};
}
