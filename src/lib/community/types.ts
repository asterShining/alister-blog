/**
 * Community data contracts and DTOs for Alister Blog.
 * Aligned with JD Cloud API v1 and Cloudflare D1 Public Read Replica.
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

export interface CommunityPost {
  id: string;
  slug: string;
  title: string;
  content: string; // Raw Markdown text
  contentFormat?: "markdown" | "mdx";
  author: CommunityAuthor;
  createdAt: string; // ISO 8601 string
  updatedAt?: string;
  publishedAt?: string;
  images: CommunityImage[];
}

export type CommunityPostSummary = CommunityPost;
export type CommunityPostDetail = CommunityPost;

export interface ListCommunityPostsOptions {
  limit?: number;
  offset?: number;
}

export interface ListCommunityPostsResult {
  posts: CommunityPost[];
  total: number;
}
