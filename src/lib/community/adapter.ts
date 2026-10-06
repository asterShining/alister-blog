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
    let posts = [...mockCommunityPosts];
    if (options?.tag) {
      posts = posts.filter((p) => p.tags?.includes(options.tag!));
    }
    const total = posts.length;
    const offset = options?.offset ?? 0;
    const limit = options?.limit ?? posts.length;
    return {
      posts: posts.slice(offset, offset + limit),
      total,
    };
  }

  async getPost(slug: string): Promise<CommunityPost | null> {
    const post = mockCommunityPosts.find((p) => p.slug === slug);
    return post ? { ...post } : null;
  }
}

export class EmptyCommunityAdapter implements CommunityAdapter {
  async listPosts(_options?: ListCommunityPostsOptions): Promise<ListCommunityPostsResult> {
    return { posts: [], total: 0 };
  }

  async getPost(_slug: string): Promise<CommunityPost | null> {
    return null;
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

export function getCommunityAdapter(): CommunityAdapter {
  if (shouldServeFixtures()) {
    return new MockCommunityAdapter();
  }
  return new EmptyCommunityAdapter();
}
