import { siteConfig } from "@config/siteConfig";
import { profileConfig } from "@config/profileConfig";

export interface SelfLinkInfo {
  name: string;
  link: string;
  avatar: string;
  descr: string;
  rss: string;
  avatarDisplay: string;
}

/**
 * Single source of truth for site friend-link info.
 * Derives name, link, avatar, descr, and rss dynamically from siteConfig and profileConfig.
 */
export function getSelfLinkInfo(): SelfLinkInfo {
  const rawSite = siteConfig.site || "https://alistereno.top/";
  const siteUrl = rawSite.endsWith("/") ? rawSite : `${rawSite}/`;

  const rawAvatar = profileConfig.avatar || "/images/profile/avatar.webp";
  const avatarPath = rawAvatar.startsWith("/") ? rawAvatar.slice(1) : rawAvatar;
  const avatarAbsoluteUrl = rawAvatar.startsWith("http")
    ? rawAvatar
    : new URL(avatarPath, siteUrl).href;

  const rssUrl = new URL("rss.xml", siteUrl).href;

  return {
    name: siteConfig.title,
    link: siteUrl,
    avatar: avatarAbsoluteUrl,
    descr: profileConfig.bio || "把喜欢的、想到的，都留在这里。",
    rss: rssUrl,
    avatarDisplay: rawAvatar,
  };
}

/**
 * Format the 5-field plain text payload for clipboard copying.
 * Output order: name, link, avatar, descr, rss.
 */
export function getSelfLinkCopyText(info: SelfLinkInfo = getSelfLinkInfo()): string {
  return [
    `name: ${info.name}`,
    `link: ${info.link}`,
    `avatar: ${info.avatar}`,
    `descr: ${info.descr}`,
    `rss: ${info.rss}`,
  ].join("\n");
}
