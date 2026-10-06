<script lang="ts">
import { onMount } from "svelte";
import type { CommunityPost } from "../../lib/community/types.ts";
import { getCommunityAdapter } from "../../lib/community/adapter.ts";
import { renderCommunityMarkdown } from "../../lib/community/markdown.ts";

let status = $state<"loading" | "success" | "notFound" | "error">("loading");
let post = $state<CommunityPost | null>(null);
let errorMessage = $state<string>("");
let loadedSlug = $state<string>("");

function getSlugFromPathname(): string {
  if (typeof window === "undefined") return "";
  const path = window.location.pathname;
  const match = path.match(/^\/community\/([^/]+)/);
  if (match && match[1] && match[1] !== "post" && match[1] !== "index.html") {
    return decodeURIComponent(match[1]);
  }
  return "";
}

async function loadPost(slug: string) {
  if (!slug) {
    status = "notFound";
    return;
  }
  if (slug === loadedSlug && status === "success") {
    return;
  }
  status = "loading";
  errorMessage = "";
  try {
    const adapter = getCommunityAdapter();
    const result = await adapter.getPost(slug);
    if (!result) {
      status = "notFound";
    } else {
      post = result;
      loadedSlug = slug;
      status = "success";
      if (typeof document !== "undefined") {
        document.title = `${result.title} - Alister's Blog`;
      }
    }
  } catch (err: unknown) {
    status = "error";
    errorMessage = err instanceof Error ? err.message : "获取轨迹详情失败";
  }
}

onMount(() => {
  const initialSlug = getSlugFromPathname();
  loadPost(initialSlug);

  const handleUrlChange = () => {
    const newSlug = getSlugFromPathname();
    if (newSlug && newSlug !== loadedSlug) {
      loadPost(newSlug);
    }
  };

  window.addEventListener("popstate", handleUrlChange);
  document.addEventListener("swup:content:replace", handleUrlChange);

  return () => {
    window.removeEventListener("popstate", handleUrlChange);
    document.removeEventListener("swup:content:replace", handleUrlChange);
  };
});
</script>

<div class="community-detail-app">
  <!-- Back Link -->
  <div class="mb-4">
    <a
      href="/community/"
      class="community-back-link inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--shape-corner-s)] bg-[var(--btn-regular-bg)] text-[var(--btn-content)] text-sm font-medium transition hover:brightness-105 active:scale-[0.98]"
    >
      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
      </svg>
      <span>返回轨迹</span>
    </a>
  </div>

  {#if status === "loading"}
    <div class="rounded-[var(--shape-corner-l)] border border-[var(--outline-variant)] bg-[var(--card-bg)] p-5 sm:p-8 animate-pulse" data-testid="community-detail-loading">
      <div class="flex items-center gap-3.5 pb-4 mb-4 border-b border-[var(--outline-variant)]">
        <div class="w-12 h-12 rounded-full bg-[var(--outline-variant)]"></div>
        <div class="space-y-2">
          <div class="h-4 bg-[var(--outline-variant)] rounded w-32"></div>
          <div class="h-3 bg-[var(--outline-variant)] rounded w-24"></div>
        </div>
      </div>
      <div class="h-6 bg-[var(--outline-variant)] rounded w-2/3 mb-6"></div>
      <div class="space-y-3">
        <div class="h-4 bg-[var(--outline-variant)] rounded w-full"></div>
        <div class="h-4 bg-[var(--outline-variant)] rounded w-5/6"></div>
        <div class="h-4 bg-[var(--outline-variant)] rounded w-4/6"></div>
      </div>
    </div>
  {:else if status === "notFound"}
    <div class="community-empty-state flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-[var(--shape-corner-l)] border border-dashed border-[var(--outline-variant)] bg-[var(--card-bg)] my-4">
      <div class="text-4xl mb-3">🔍</div>
      <h2 class="text-xl sm:text-2xl font-bold text-[var(--on-surface)] mb-2">未找到该轨迹</h2>
      <p class="text-[var(--on-surface-variant)] text-sm sm:text-base max-w-md mb-6 leading-relaxed">
        这条轨迹可能已被删除、设为私密或链接输入有误。
      </p>
      <a
        href="/community/"
        class="inline-flex items-center gap-2 px-5 py-2.5 rounded-[var(--shape-corner-s)] bg-[var(--btn-regular-bg)] text-[var(--btn-content)] font-medium text-sm transition hover:brightness-105"
      >
        <span>返回轨迹列表</span>
      </a>
    </div>
  {:else if status === "error"}
    <div class="community-error-card rounded-[var(--shape-corner-l)] border border-[var(--outline-variant)] bg-[var(--card-bg)] p-6 text-center my-4">
      <div class="text-3xl mb-2">⚠️</div>
      <h2 class="text-lg font-bold text-[var(--on-surface)] mb-1">加载失败</h2>
      <p class="text-sm text-[var(--on-surface-variant)] mb-4">{errorMessage || "无法获取轨迹内容，请稍后重试。"}</p>
      <button
        type="button"
        onclick={() => loadPost(getSlugFromPathname())}
        class="inline-flex items-center gap-1.5 px-4 py-2 rounded-[var(--shape-corner-s)] bg-[var(--primary)] text-white text-sm font-medium transition hover:opacity-90"
      >
        <span>重新加载</span>
      </button>
    </div>
  {:else if status === "success" && post}
    <article class="community-detail-card rounded-[var(--shape-corner-l)] border border-[var(--outline-variant)] bg-[var(--card-bg)] p-5 sm:p-8">
      <!-- Author Header -->
      <header class="community-detail-header flex items-center gap-3.5 pb-4 mb-4 border-b border-[var(--outline-variant)]">
        <img
          src={post.author.avatar || "/images/profile/avatar.webp"}
          alt={post.author.name}
          class="w-12 h-12 rounded-full object-cover border border-[var(--outline-variant)] flex-shrink-0"
          loading="eager"
          decoding="async"
        />
        <div>
          <div class="font-bold text-base sm:text-lg text-[var(--on-surface)] leading-tight">
            {post.author.name}
          </div>
          <div class="flex items-center gap-2 text-xs sm:text-sm text-[var(--on-surface-variant)] mt-1">
            <time datetime={post.createdAt}>发布于 {post.createdAt ? post.createdAt.slice(0, 10) : ""}</time>
            {#if post.updatedAt}
              <span>· 编辑于 {post.updatedAt.slice(0, 10)}</span>
            {/if}
          </div>
        </div>
      </header>

      <!-- Title -->
      <h1 class="community-detail-title text-xl sm:text-2xl font-bold text-[var(--on-surface)] mb-4 leading-snug">
        {post.title}
      </h1>

      <!-- Content -->
      <div class="community-detail-body text-sm sm:text-base leading-relaxed text-[var(--on-surface)] my-4">
        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
        {@html renderCommunityMarkdown(post.content)}
      </div>

      <!-- Images -->
      {#if post.images && post.images.length > 0}
        <div class="community-detail-images my-6">
          {#if post.images.length === 1}
            <div class="max-w-lg">
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
                  loading="lazy"
                  decoding="async"
                  class="w-full max-h-[460px] object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                />
              </a>
            </div>
          {:else if post.images.length === 2}
            <div class="grid grid-cols-2 gap-2 sm:gap-3 max-w-xl">
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
          {:else}
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 max-w-2xl">
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

      <!-- Interaction Phase Notice -->
      <aside class="community-phase-notice mt-6 p-4 rounded-[var(--shape-corner-m)] bg-[var(--surface-container)] border border-[var(--outline-variant)] flex items-start gap-3 text-xs sm:text-sm text-[var(--on-surface-variant)]">
        <span class="text-base text-[var(--primary)] mt-0.5">💡</span>
        <div>
          <p class="font-medium text-[var(--on-surface)] mb-0.5">关于轨迹互动</p>
          <p>当前阶段仅提供轨迹浏览，互动功能（点赞与评论）将在后续阶段开放。</p>
        </div>
      </aside>
    </article>

    <!-- Bottom navigation -->
    <div class="mt-6 flex justify-between items-center px-1">
      <a
        href="/community/"
        class="text-sm font-medium text-[var(--primary)] hover:underline inline-flex items-center gap-1"
      >
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        <span>返回轨迹列表</span>
      </a>
      <a
        href="/"
        class="text-sm font-medium text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]"
      >
        返回博客首页
      </a>
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
