/**
 * 游戏展示页数据源（纯内容）。
 * 页面展示与筛选规则由 src/config/gamesConfig.ts 控制。
 *
 * 封面支持三种写法：
 * - src/assets 相对路径（如本文件所用，走 Astro 图片管线自动优化为 webp/avif）；
 * - /public 绝对路径（如 "/assets/games/xxx.webp"，原样输出）；
 * - 远程 URL（https://…）。
 *
 * 当前保持空列表；有真实记录后再按 GameItem 结构添加。
 */
import type { GameItem } from "@/types/gamesConfig";

export const gamesData: GameItem[] = [];
