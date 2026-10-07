import type {
  CommunityPost,
  ListCommunityPostsOptions,
  ListCommunityPostsResult,
} from "./types.ts";
import { mockCommunityPosts } from "./fixtures.ts";
import {
  cachedCommunityRead,
  COMMUNITY_READ_TTL_MS,
  publishCommunityTotal,
} from "./read-cache.ts";

export interface CommunityAdapter {
  listPosts(options?: ListCommunityPostsOptions): Promise<ListCommunityPostsResult>;
  getPost(slug: string): Promise<CommunityPost | null>;
}

export class MockCommunityAdapter implements CommunityAdapter {
  async listPosts(options?: ListCommunityPostsOptions): Promise<ListCommunityPostsResult> {
    const total = mockCommunityPosts.length;
    const offset = options?.offset ?? 0;
    const limit = options?.limit ?? mockCommunityPosts.length;
    return {
      posts: mockCommunityPosts.slice(offset, offset + limit),
      total,
    };
  }

  async getPost(slug: string): Promise<CommunityPost | null> {
    const post = mockCommunityPosts.find((p) => p.slug === slug);
    return post ? { ...post } : null;
  }
}

export class ApiCommunityAdapter implements CommunityAdapter {
  private baseUrl: string;

  constructor(baseUrl = "") {
    this.baseUrl = baseUrl;
  }

  /**
   * Cached and de-duplicated on purpose: the homepage feed, the sidebar total
   * and the `/community/` feed all read the same public list, and a visitor can
   * trigger all three within one browsing session. See `read-cache.ts`.
   */
  listPosts(options?: ListCommunityPostsOptions): Promise<ListCommunityPostsResult> {
    const limit = options?.limit;
    const offset = options?.offset ?? 0;
    const key = `community:posts:limit=${limit ?? "default"}:offset=${offset}`;
    return cachedCommunityRead(key, async () => {
      const result = await this.requestListPosts(limit, offset);
      // Any list response carries the authoritative total; share it so a
      // consumer that only needs the count never issues its own request.
      publishCommunityTotal(result.total);
      return result;
    });
  }

  private async requestListPosts(
    limit: number | undefined,
    offset: number,
  ): Promise<ListCommunityPostsResult> {
    const params = new URLSearchParams();
    if (limit !== undefined) params.set("limit", String(limit));
    if (offset) params.set("offset", String(offset));
    const qs = params.toString();
    const url = `${this.baseUrl}/api/v1/community/posts${qs ? `?${qs}` : ""}`;

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to fetch community posts: ${res.status}`);
    }
    const json = (await res.json()) as { code: number; data?: { posts: CommunityPost[]; total: number }; message?: string };
    if (json.code !== 0 || !json.data) {
      throw new Error(json.message || "Invalid community posts response");
    }
    return {
      posts: json.data.posts || [],
      total: json.data.total || 0,
    };
  }

  getPost(slug: string): Promise<CommunityPost | null> {
    return cachedCommunityRead(
      `community:post:${slug}`,
      async () => {
        const url = `${this.baseUrl}/api/v1/community/posts/${encodeURIComponent(slug)}`;
        const res = await fetch(url);
        if (res.status === 404) {
          return null;
        }
        if (!res.ok) {
          throw new Error(`Failed to fetch community post: ${res.status}`);
        }
        const json = (await res.json()) as { code: number; data?: CommunityPost; message?: string };
        if (json.code !== 0 || !json.data) {
          return null;
        }
        return json.data;
      },
      COMMUNITY_READ_TTL_MS,
    );
  }
}

export function shouldServeFixtures(): boolean {
  if (typeof process !== "undefined" && process.env) {
    if (process.env.COMMUNITY_USE_FIXTURES === "true" || process.env.COMMUNITY_USE_FIXTURES === "1") {
      return true;
    }
  }
  try {
    if (import.meta.env && import.meta.env.DEV) {
      return true;
    }
  } catch {}
  return false;
}

export function getCommunityAdapter(baseUrl?: string): CommunityAdapter {
  if (shouldServeFixtures()) {
    return new MockCommunityAdapter();
  }
  return new ApiCommunityAdapter(baseUrl);
}
