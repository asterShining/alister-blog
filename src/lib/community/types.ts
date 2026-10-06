/**
 * Community data contracts and DTOs for Alister Blog.
 * Aligned with the planned JD Cloud API and Cloudflare D1 schema.
 */

export interface CommunityImage {
  url: string;
  alt?: string;
  width?: number;
  height?: number;
}

export interface CommunityAuthor {
  name: string;
  avatar?: string;
}

export interface CommunityStats {
  likes?: number;
  comments?: number;
}

export interface CommunityPost {
  id: string;
  slug: string;
  title?: string;
  content: string; // Raw Markdown text
  author: CommunityAuthor;
  createdAt: string; // ISO 8601 string
  updatedAt?: string;
  images?: CommunityImage[];
  tags?: string[];
  stats?: CommunityStats;
}

export type CommunityPostSummary = CommunityPost;
export type CommunityPostDetail = CommunityPost;

export interface ListCommunityPostsOptions {
  limit?: number;
  offset?: number;
  tag?: string;
}

export interface ListCommunityPostsResult {
  posts: CommunityPost[];
  total: number;
}
