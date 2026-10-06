import test from "node:test";
import assert from "node:assert/strict";

import {
  escapeHtml,
  renderCommunityMarkdown,
  mockCommunityPosts,
  MockCommunityAdapter,
  ApiCommunityAdapter,
} from "../src/lib/community/index.ts";

test("escapeHtml escapes dangerous HTML characters", () => {
  const dangerous = `<script>alert("xss")</script>&'`;
  const escaped = escapeHtml(dangerous);
  assert.equal(
    escaped,
    "&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;&amp;&#39;",
  );
});

test("renderCommunityMarkdown sanitizes raw HTML and script tags", () => {
  const input = `Hello <script>alert(1)</script> and <img src=x onerror=alert(2)>`;
  const html = renderCommunityMarkdown(input);
  assert.ok(!html.includes("<script>"));
  assert.ok(!html.includes("<img"));
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(html.includes("&lt;img"));
});

test("renderCommunityMarkdown renders headings, bold, inline code, and lists", () => {
  const input = `### 小标题
这是一个 **重点** 词汇和 \`const a = 1\` 行内代码。

- 列表项 1
- 列表项 2`;

  const html = renderCommunityMarkdown(input);
  assert.ok(html.includes('<h3 class="community-h3">小标题</h3>'));
  assert.ok(html.includes("<strong>重点</strong>"));
  assert.ok(html.includes('<code class="community-inline-code">const a = 1</code>'));
  assert.ok(html.includes('<ul class="community-list community-list--ul">'));
  assert.ok(html.includes("<li>列表项 1</li>"));
  assert.ok(html.includes("<li>列表项 2</li>"));
});

test("renderCommunityMarkdown handles fenced code blocks safely", () => {
  const input = `\`\`\`python
import os
print("hello <world>")
\`\`\``;

  const html = renderCommunityMarkdown(input);
  assert.ok(html.includes('<pre class="community-codeblock"><code data-lang="python">'));
  assert.ok(html.includes("&lt;world&gt;"));
});

test("renderCommunityMarkdown allows safe links and rejects dangerous protocols", () => {
  const safe = `[安全链接](https://example.com/test) 和 [站内链接](/posts/test)`;
  const safeHtml = renderCommunityMarkdown(safe);
  assert.ok(safeHtml.includes('href="https://example.com/test"'));
  assert.ok(safeHtml.includes('href="/posts/test"'));

  const unsafe = `[恶意链接](javascript:alert(1))`;
  const unsafeHtml = renderCommunityMarkdown(unsafe);
  assert.ok(!unsafeHtml.includes("href="));
  assert.ok(unsafeHtml.includes("恶意链接"));
});

test("mockCommunityPosts contains 4 diverse items with required titles", () => {
  assert.equal(mockCommunityPosts.length, 4);

  // K230 has 2 images
  const k230 = mockCommunityPosts.find((p) => p.slug === "k230-canmv-debug");
  assert.ok(k230);
  assert.equal(k230.images.length, 2);
  assert.equal(typeof k230.title, "string");

  // ROS2 has 4 images
  const ros = mockCommunityPosts.find((p) => p.slug === "ros2-nav2-simulation");
  assert.ok(ros);
  assert.equal(ros.images.length, 4);

  // Anime has 1 image
  const anime = mockCommunityPosts.find((p) => p.slug === "anime-review-girls-band-cry");
  assert.ok(anime);
  assert.equal(anime.images.length, 1);

  // Thoughts has 0 images and required title
  const thoughts = mockCommunityPosts.find((p) => p.slug === "weekly-random-thoughts");
  assert.ok(thoughts);
  assert.equal(thoughts.images.length, 0);
  assert.equal(thoughts.title, "日常碎碎念与代码整理");
});

test("MockCommunityAdapter lists and filters posts", async () => {
  const adapter = new MockCommunityAdapter();
  const all = await adapter.listPosts();
  assert.equal(all.total, 4);
  assert.equal(all.posts.length, 4);

  const paginated = await adapter.listPosts({ limit: 2, offset: 1 });
  assert.equal(paginated.posts.length, 2);
  assert.equal(paginated.posts[0].slug, "ros2-nav2-simulation");

  const single = await adapter.getPost("k230-canmv-debug");
  assert.ok(single);
  assert.equal(single.id, "comm_01");

  const notFound = await adapter.getPost("non-existent");
  assert.equal(notFound, null);
});

test("ApiCommunityAdapter queries API correctly", async () => {
  // Test ApiCommunityAdapter with a mock fetch
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (url) => {
      const u = String(url);
      if (u.includes("/api/v1/community/posts/not-found")) {
        return new Response(JSON.stringify({ code: 404, message: "Not found" }), { status: 404 });
      }
      if (u.includes("/api/v1/community/posts/sample")) {
        return new Response(
          JSON.stringify({
            code: 0,
            data: {
              id: "p1",
              slug: "sample",
              title: "Sample",
              content: "Body",
              author: { name: "Alister" },
              createdAt: "2026-10-06T12:00:00Z",
              images: [],
            },
          }),
          { status: 200 },
        );
      }
      return new Response(
        JSON.stringify({
          code: 0,
          data: {
            posts: [
              {
                id: "p1",
                slug: "sample",
                title: "Sample",
                content: "Body",
                author: { name: "Alister" },
                createdAt: "2026-10-06T12:00:00Z",
                images: [],
              },
            ],
            total: 1,
          },
        }),
        { status: 200 },
      );
    };

    const adapter = new ApiCommunityAdapter("https://mock.api");
    const list = await adapter.listPosts({ limit: 10 });
    assert.equal(list.total, 1);
    assert.equal(list.posts.length, 1);
    assert.equal(list.posts[0].slug, "sample");

    const post = await adapter.getPost("sample");
    assert.ok(post);
    assert.equal(post.slug, "sample");

    const nullPost = await adapter.getPost("not-found");
    assert.equal(nullPost, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
