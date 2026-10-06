# Alister Blog Community Data Contract & API Specification

> **Phase**: Community First Real Post Production Phase
> **Status**: Production Enabled; first real text post verified (2026-10-07)
> **Target Backends**: Cloudflare Pages Functions (Edge Public API) & JD Cloud Fastify (`alister-api`)

---

## 1. 架构定位与数据流 (Architecture & Data Flow)

Community 是 Alister Blog 的短内容广场（动态、短图文、项目随笔、日常碎碎念），与长文章系统（`/posts/` Markdown/MDX）相互独立。

### 1.1 双系统职责边界

| 维度 | 文章系统 (`/posts/`) | Community 广场 (`/community/`) |
| :--- | :--- | :--- |
| **内容形式** | 长文 Markdown / MDX，深度技术或随笔 | 短图文、动态、调试日记、短评、碎碎念 |
| **权威存储** | 代码仓 `shirones/content/posts/` (Git) | **JD Cloud PostgreSQL** (`alister-api`) |
| **边缘交付** | Astro SSG 静态预渲染 | **Cloudflare D1** (`alister-public` 只读副本) + Pages Functions |
| **编辑入口** | Git 提交 / 将来 JD Admin Markdown 编辑器 | JD Admin 动态发布模块 |
| **互动模型** | 浏览量统计 (Views) + 点赞 (Likes) + 评论 | 浏览（第一阶段）→ 点赞与评论（后续阶段） |

### 1.2 数据流向与运行时交付

```
[JD Admin / Alister] 
        │ (管理、新建、编辑、图片上传至对象存储)
        ▼
[JD Cloud PostgreSQL]  <-- 权威主源 (Source of Truth)
        │
        │ (定向同步管道 / Sync Pipeline)
        ▼
[Cloudflare D1 (alister-public)]  <-- 边缘只读分发副本 (Edge Read-Only Replica)
        │
        ├── [GET /api/v1/community/posts] (Pages Function)
        ├── [GET /api/v1/community/posts/:slug] (Pages Function)
        └── [GET /community/:slug/] (Pages Function: 动态 Shell 代理分发)
                 │ (ASSETS.fetch -> /community/post/ static shell)
                 ▼
[Alister Blog Client (Svelte 5 Runtime)]
        │ (运行时读取 pathname 并向 D1 API 异步拉取动态详情)
        ▼
[页面无缝呈现]
```

> [!IMPORTANT]
> **权威主源原则**：JD Cloud PostgreSQL 是 Community 数据的唯一写入与权威主库。访客侧边缘 API 与 Cloudflare D1 仅承载只读副本及访客互动计数，不直接承接管理写入。
> **静态 Shell + 运行时直读**：通过 `functions/community/[slug].ts` 调用 `env.ASSETS.fetch()` 转发至预渲染静态壳 `/community/post/`，无需 Astro 全站 SSR 重构，保持静态 CDN 高速缓存体验。

---

## 2. 前端数据契约 (TypeScript Types)

前端已在 `src/lib/community/types.ts` 定义核心 DTO：

```typescript
export interface CommunityImage {
  url: string;
  alt?: string;
}

export interface CommunityAuthor {
  name: string;
  avatar?: string;
}

export interface CommunityPost {
  id: string;
  slug: string;
  title: string; // 第一版规范：标题为必填项
  content: string; // 原始 Markdown 格式纯文本
  contentFormat?: "markdown" | "mdx";
  author: CommunityAuthor;
  createdAt: string; // ISO 8601 字符串 (e.g. "2026-10-06T14:30:00Z")
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
```

---

## 3. 边缘 Public API 规范 (Cloudflare Pages Functions)

边缘 Functions 提供以下两个只读端点：

### 3.1 动态列表 `GET /api/v1/community/posts`

- **请求方式**: `GET`
- **Query 参数**:
  - `limit` (optional, integer, default: `20`, max: `50`): 每页数量
  - `offset` (optional, integer, default: `0`): 偏移量
- **过滤与排序**:
  - 仅返回 `visibility = 'public'` 的动态。
  - 按 `published_at DESC, created_at DESC` 降序排列。
- **响应格式 (JSON)**:

```json
{
  "code": 0,
  "data": {
    "total": 1,
    "posts": [
      {
        "id": "comm_01",
        "slug": "k230-canmv-debug",
        "title": "K230 端侧模型部署与摄像头帧率踩坑记",
        "content": "折腾了几天 CanMV K230 的模型部署...",
        "contentFormat": "markdown",
        "author": {
          "name": "Alister",
          "avatar": "/images/profile/avatar.webp"
        },
        "createdAt": "2026-10-06T14:30:00Z",
        "publishedAt": "2026-10-06T14:30:00Z",
        "images": [
          {
            "url": "https://img.alistereno.top/community/k230-board.webp",
            "alt": "K230 开发板调试环境"
          }
        ]
      }
    ]
  }
}
```

### 3.2 动态详情 `GET /api/v1/community/posts/:slug`

- **请求方式**: `GET`
- **Path 参数**:
  - `slug` (string, required): 动态的唯一 slug
- **权限与可见性**:
  - 允许读取 `visibility IN ('public', 'unlisted')`。
  - 草稿 (`draft`) 或归档 (`archived`) 返回 404。
- **响应格式 (JSON)**:

```json
{
  "code": 0,
  "data": {
    "id": "comm_01",
    "slug": "k230-canmv-debug",
    "title": "K230 端侧模型部署与摄像头帧率踩坑记",
    "content": "折腾了几天 CanMV K230 的模型部署...",
    "contentFormat": "markdown",
    "author": {
      "name": "Alister",
      "avatar": "/images/profile/avatar.webp"
    },
    "createdAt": "2026-10-06T14:30:00Z",
    "publishedAt": "2026-10-06T14:30:00Z",
    "images": [
      {
        "url": "https://img.alistereno.top/community/k230-board.webp",
        "alt": "K230 开发板调试环境"
      }
    ]
  }
}
```

- **404 响应**:
```json
{
  "code": 404,
  "error": "POST_NOT_FOUND",
  "message": "Community post not found"
}
```

---

## 4. 安全与渲染规范

1. **富文本安全**:
   - 前端采用安全 Markdown 渲染器 (`src/lib/community/markdown.ts`)，所有用户或内容字符默认进行 HTML 转义。
   - 链接严格限制安全协议 (`http://`, `https://`, 站内相对路径 `/`, 锚点 `#`)，严禁 `javascript:` 或 `data:` 伪协议。
   - 绝不使用不受信任的 `innerHTML`。
2. **防脏数据原则**:
   - 生产环境构建在未接入真实边缘 API 前，Adapter 返回空列表，呈现友好空状态，绝不在正式生产环境中输出测试 mock 数据。
   - 本地开发与 Playwright E2E 测试环境可通过 `COMMUNITY_USE_FIXTURES=true` 注入完备的测试 fixtures。

---

## 5. D1 边缘只读副本表结构 (D1 Read Replica Schema)

对应 D1 迁移文件：`migrations/0004_community_public.sql`（已应用 Production；禁止修改已应用迁移，后续 remote migration 仍需明确授权）。

### 5.1 `community_posts`
```sql
CREATE TABLE community_posts (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  content_format TEXT NOT NULL DEFAULT 'markdown' CHECK(content_format IN ('markdown', 'mdx')),
  visibility TEXT NOT NULL DEFAULT 'public' CHECK(visibility IN ('public', 'unlisted')),
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_community_posts_visibility_published ON community_posts(visibility, published_at DESC, created_at DESC);
CREATE UNIQUE INDEX idx_community_posts_slug ON community_posts(slug);
```

### 5.2 `community_post_images`
```sql
CREATE TABLE community_post_images (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  object_key TEXT NOT NULL CHECK(length(trim(object_key)) > 0),
  alt_text TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0 CHECK(sort_order >= 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(post_id, sort_order)
);

CREATE INDEX idx_community_post_images_post_id ON community_post_images(post_id, sort_order ASC);
```

> [!NOTE]
> - 不在 D1 创建任何管理表、sync_state 或草稿私密数据。
> - 访客公开列表仅查 `visibility = 'public'`，详情直查允许 `public` 与 `unlisted`。
> - 严禁在 API 响应中暴露内部字段（如对象存储 key、SQL 细节、错误堆栈）。

## 6. 图片跨仓库契约

JD PostgreSQL 与 D1 public replica 均保存 canonical `object_key`，不保存 resolved URL 或 width/height metadata。Pages Functions 使用可选 `COMMUNITY_MEDIA_BASE_URL` 与规范化 object key 生成 HTTP(S) URL。Browser DTO v1 仅含 `url` 与可选 `alt`，不暴露 object_key。

base 尾部和 key 开头斜杠会规范化；危险协议、路径穿越及非法配置会被拒绝。未配置 media base 时，无图内容正常返回；查到图片则返回脱敏 HTTP 500，不泄漏 key 或环境配置。0004 已应用 Production，不得再修改该迁移。Community Production 已开启只读 feed/detail，首帖为 `community-start`；本阶段无图片，未配置 media base，未启用 R2。

## 7. Production 发布边界

私有 Operator CLI 复用 PostgreSQL Repository：create 始终 draft/public/markdown，published_at 为 null；Production create/publish/archive 必须显式 `--confirm-production`。只有 publish 后满足 Publisher eligibility 的内容才会手动同步到 D1。CLI 不直接操作 D1，公开 Pages API 仍只读。

首帖生产验收已验证 draft 隔离、1 insert、live sync、再次 dry-run 0 diff、checkpoint 与公开 DTO。UI 由 Production 普通文本 `COMMUNITY_ENABLE=true` 在构建时启用，须重新构建部署；默认本地配置仍关闭。部署事实见 `docs/project-status.md`。

图片、Community 点赞/评论写入、多人发帖、Admin UI、自动同步不属于已完成阶段。
