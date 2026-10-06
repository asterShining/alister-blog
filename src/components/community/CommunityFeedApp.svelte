<script lang="ts">
import { onMount } from "svelte";
import type { CommunityPost } from "../../lib/community/types.ts";
import { getCommunityAdapter } from "../../lib/community/adapter.ts";
import { renderCommunityMarkdown } from "../../lib/community/markdown.ts";

let status = $state<"loading" | "success" | "empty" | "error">("loading");
let posts = $state<CommunityPost[]>([]);
let errorMessage = $state<string>("");

async function loadFeed() {
  status = "loading";
  errorMessage = "";
  try {
    const adapter = getCommunityAdapter();
    const result = await adapter.listPosts();
    posts = result.posts;
    if (posts.length === 0) {
      status = "empty";
    } else {
      status = "success";
    }
  } catch (err: unknown) {
    status = "error";
    errorMessage = err instanceof Error ? err.message : "获取轨迹列表失败";
  }
}

onMount(() => {
  loadFeed();
});
</script>

<div class="community-feed-app">
  {#if status === "loading"}
    <div class="community-loading-stack flex flex-col gap-4 sm:gap-6" data-testid="community-loading">
      {#each [1, 2] as _}
        <div class="rounded-[var(--shape-corner-l)] border border-[var(--outline-variant)] bg-[var(--card-bg)] p-4 sm:p-6 animate-pulse">
          <div class="flex items-center gap-3 mb-4">
            <div class="w-10 h-10 rounded-full bg-[var(--outline-variant)]"></div>
            <div class="flex-1 space-y-2">
              <div class="h-4 bg-[var(--outline-variant)] rounded w-28"></div>
              <div class="h-3 bg-[var(--outline-variant)] rounded w-20"></div>
            </div>
          </div>
          <div class="space-y-2.5">
            <div class="h-4 bg-[var(--outline-variant)] rounded w-3/4"></div>
            <div class="h-4 bg-[var(--outline-variant)] rounded w-full"></div>
            <div class="h-4 bg-[var(--outline-variant)] rounded w-2/3"></div>
          </div>
        </div>
      {/each}
    </div>
  {:else if status === "error"}
    <div class="community-error-card rounded-[var(--shape-corner-l)] border border-[var(--outline-variant)] bg-[var(--card-bg)] p-6 text-center my-4">
      <div class="text-3xl mb-2">⚠️</div>
      <h2 class="text-lg font-bold text-[var(--on-surface)] mb-1">轨迹加载失败</h2>
      <p class="text-sm text-[var(--on-surface-variant)] mb-4">{errorMessage || "无法获取轨迹，请稍后重试。"}</p>
      <button
        type="button"
        onclick={loadFeed}
        class="inline-flex items-center gap-1.5 px-4 py-2 rounded-[var(--shape-corner-s)] bg-[var(--primary)] text-white text-sm font-medium transition hover:opacity-90"
      >
        <span>重新加载</span>
      </button>
    </div>
  {:else if status === "empty"}
    <div class="community-empty-state flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-[var(--shape-corner-l)] border border-dashed border-[var(--outline-variant)] bg-[var(--card-bg)] my-4">
      <div class="w-14 h-14 rounded-[var(--shape-corner-m)] bg-[var(--btn-regular-bg)] flex items-center justify-center text-[var(--btn-content)] text-2xl mb-4">
        💬
      </div>
      <h2 class="text-xl sm:text-2xl font-bold text-[var(--on-surface)] mb-2">还没有轨迹呢</h2>
      <p class="text-[var(--on-surface-variant)] text-sm sm:text-base max-w-md mb-6 leading-relaxed">
        Alister 还没发布任何轨迹记录，过段时间再来看看吧。
      </p>
      <a
        href="/"
        class="inline-flex items-center gap-2 px-5 py-2.5 rounded-[var(--shape-corner-s)] bg-[var(--btn-regular-bg)] text-[var(--btn-content)] font-medium text-sm transition hover:brightness-105"
      >
        <span>返回首页</span>
      </a>
    </div>
  {:else if status === "success"}
    <div class="community-feed flex flex-col gap-4 sm:gap-6">
      {#each posts as post (post.id)}
        <article
          class="community-post-card rounded-[var(--shape-corner-l)] border border-[var(--outline-variant)] bg-[var(--card-bg)] p-4 sm:p-6 transition hover:shadow-md"
          data-post-slug={post.slug}
        >
          <!-- Header -->
          <header class="community-post-card__header flex items-center justify-between mb-3">
            <div class="flex items-center gap-3 min-w-0">
              <img
                src={post.author.avatar || "/images/profile/avatar.webp"}
                alt={post.author.name}
                class="w-10 h-10 rounded-full object-cover border border-[var(--outline-variant)] flex-shrink-0"
                loading="lazy"
                decoding="async"
              />
              <div class="min-w-0">
                <div class="font-bold text-[var(--on-surface)] text-sm sm:text-base leading-tight truncate">
                  {post.author.name}
                </div>
                <time
                  datetime={post.createdAt}
                  class="text-xs text-[var(--on-surface-variant)] block mt-0.5"
                >
                  {post.createdAt ? post.createdAt.slice(0, 10) : ""}
                </time>
              </div>
            </div>
            <a
              href={`/community/${post.slug}/`}
              class="text-[var(--on-surface-variant)] hover:text-[var(--primary)] transition p-1 rounded-[var(--shape-corner-xs)] inline-flex items-center"
              aria-label={`查看轨迹详情: ${post.title}`}
              title="查看详情"
            >
              <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </a>
          </header>

          <!-- Title -->
          <h2 class="community-post-card__title font-bold text-lg sm:text-xl text-[var(--on-surface)] mb-2.5 leading-snug">
            <a href={`/community/${post.slug}/`} class="hover:text-[var(--primary)] transition">
              {post.title}
            </a>
          </h2>

          <!-- Content Body -->
          <div class="community-post-card__content text-sm sm:text-base leading-relaxed text-[var(--on-surface)]">
            <!-- eslint-disable-next-line svelte/no-at-html-tags -->
            {@html renderCommunityMarkdown(post.content)}
          </div>

          <!-- Image Grid -->
          {#if post.images && post.images.length > 0}
            <div class="community-image-grid-wrapper mt-3">
              {#if post.images.length === 1}
                <div class="community-image-grid community-image-grid--1 max-w-lg">
                  <a
                    href={post.images[0].url}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="block overflow-hidden rounded-[var(--shape-corner-m)] border border-[var(--outline-variant)] group"
                    aria-label={post.images[0].alt || "查看图片"}
                  >
                    <img
                      src={post.images[0].url}
                      alt={post.images[0].alt || ""}
                      width={post.images[0].width}
                      height={post.images[0].height}
                      loading="lazy"
                      decoding="async"
                      class="w-full max-h-[420px] object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                    />
                  </a>
                </div>
              {:else if post.images.length === 2}
                <div class="community-image-grid community-image-grid--2 grid grid-cols-2 gap-2 sm:gap-3 max-w-xl">
                  {#each post.images as img, idx}
                    <a
                      href={img.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      class="block overflow-hidden rounded-[var(--shape-corner-m)] border border-[var(--outline-variant)] aspect-[4/3] group"
                      aria-label={img.alt || `查看图片 ${idx + 1}`}
                    >
                      <img
                        src={img.url}
                        alt={img.alt || ""}
                        loading="lazy"
                        decoding="async"
                        class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                      />
                    </a>
                  {/each}
                </div>
              {:else if post.images.length === 4}
                <div class="community-image-grid community-image-grid--4 grid grid-cols-2 gap-2 sm:gap-3 max-w-lg">
                  {#each post.images as img, idx}
                    <a
                      href={img.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      class="block overflow-hidden rounded-[var(--shape-corner-m)] border border-[var(--outline-variant)] aspect-square group"
                      aria-label={img.alt || `查看图片 ${idx + 1}`}
                    >
                      <img
                        src={img.url}
                        alt={img.alt || ""}
                        loading="lazy"
                        decoding="async"
                        class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                      />
                    </a>
                  {/each}
                </div>
              {:else}
                <div class="community-image-grid community-image-grid--multi grid grid-cols-3 gap-2 sm:gap-3 max-w-2xl">
                  {#each post.images as img, idx}
                    <a
                      href={img.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      class="block overflow-hidden rounded-[var(--shape-corner-m)] border border-[var(--outline-variant)] aspect-square group"
                      aria-label={img.alt || `查看图片 ${idx + 1}`}
                    >
                      <img
                        src={img.url}
                        alt={img.alt || ""}
                        loading="lazy"
                        decoding="async"
                        class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                      />
                    </a>
                  {/each}
                </div>
              {/if}
            </div>
          {/if}

          <!-- Footer -->
          <footer class="community-post-card__footer flex items-center justify-end mt-4 pt-3 border-t border-[var(--outline-variant)] text-xs sm:text-sm text-[var(--on-surface-variant)]">
            <a
              href={`/community/${post.slug}/`}
              class="community-post-card__more-link inline-flex items-center gap-1 font-medium text-[var(--primary)] hover:underline"
            >
              <span>全文详情</span>
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </a>
          </footer>
        </article>
      {/each}
    </div>
  {/if}
</div>

<style>
  :global(.community-p) {
    margin: 0.5rem 0;
    line-height: 1.65;
  }
  :global(.community-p:first-child) {
    margin-top: 0;
  }
  :global(.community-p:last-child) {
    margin-bottom: 0;
  }
  :global(.community-h1) {
    font-size: 1.25rem;
    font-weight: 700;
    margin: 0.75rem 0 0.5rem;
    color: var(--on-surface);
  }
  :global(.community-h2) {
    font-size: 1.15rem;
    font-weight: 700;
    margin: 0.75rem 0 0.5rem;
    color: var(--on-surface);
  }
  :global(.community-h3) {
    font-size: 1.05rem;
    font-weight: 600;
    margin: 0.65rem 0 0.4rem;
    color: var(--on-surface);
  }
  :global(.community-blockquote) {
    border-left: 3px solid var(--primary);
    padding-left: 0.75rem;
    margin: 0.5rem 0;
    color: var(--on-surface-variant);
    font-style: italic;
  }
  :global(.community-list) {
    margin: 0.5rem 0;
    padding-left: 1.25rem;
    line-height: 1.6;
  }
  :global(.community-list--ul) {
    list-style-type: disc;
  }
  :global(.community-list--ol) {
    list-style-type: decimal;
  }
  :global(.community-codeblock) {
    background: var(--codeblock-bg);
    border: 1px solid var(--outline-variant);
    border-radius: var(--shape-corner-m);
    padding: 0.75rem 1rem;
    margin: 0.75rem 0;
    overflow-x: auto;
    font-family: monospace;
    font-size: 0.875rem;
  }
  :global(.community-inline-code) {
    background: var(--inline-code-bg);
    color: var(--inline-code-color);
    padding: 0.15rem 0.35rem;
    border-radius: var(--shape-corner-xs);
    font-size: 0.9em;
    font-family: monospace;
  }
  :global(.community-link) {
    color: var(--primary);
    text-decoration: underline;
    text-underline-offset: 3px;
  }
</style>
