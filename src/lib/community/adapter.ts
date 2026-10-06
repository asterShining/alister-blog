import type {
  CommunityPost,
  ListCommunityPostsOptions,
  ListCommunityPostsResult,
} from "./types.ts";
import { mockCommunityPosts } from "./fixtures.ts";

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

  async listPosts(options?: ListCommunityPostsOptions): Promise<ListCommunityPostsResult> {
    const params = new URLSearchParams();
    if (options?.limit !== undefined) params.set("limit", String(options.limit));
    if (options?.offset !== undefined) params.set("offset", String(options.offset));
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

  async getPost(slug: string): Promise<CommunityPost | null> {
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
