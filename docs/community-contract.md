# Alister Blog Community Data Contract & API Specification

> **Phase**: Community Frontend Foundation (Phase 1)  
> **Status**: Draft / Contract Specification  
> **Target Backends**: Cloudflare Pages Functions (Edge Public API) & JD Cloud Fastify (`alister-api`)

---

## 1. 架构定位与数据流 (Architecture & Data Flow)

Community 是 Alister Blog 的短内容广场（动态、短图文、项目随笔、日常碎碎念），与长文章系统（`/posts/` Markdown/MDX）相互独立。

### 1.1 双系统职责边界

| 维度 | 文章系统 (`/posts/`) | Community 广场 (`/community/`) |
| :--- | :--- | :--- |
| **内容形式** | 长文 Markdown / MDX，深度技术或随笔 | 短图文、动态、调试日记、短评、碎碎念 |
| **权威存储** | 代码仓 `shirones/content/posts/` (Git) | **JD Cloud PostgreSQL** (`alister-api`) |
| **边缘交付** | Astro SSG 静态预渲染 | **Cloudflare D1** (`alister-public` 只读副本 / 缓存) |
| **编辑入口** | Git 提交 / 将来 JD Admin Markdown 编辑器 | JD Admin 动态发布模块 |
| **互动模型** | 浏览量统计 (Views) + 点赞 (Likes) + 评论 | 浏览（第一阶段）→ 点赞与评论（后续阶段） |

### 1.2 数据流向

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
        │ (Cloudflare Pages Functions)
        ▼
[GET /api/v1/community/posts]
[GET /api/v1/community/posts/:slug]
        │
        ▼
[Alister Blog Frontend (/community/)]
```

> [!IMPORTANT]
> **权威主源原则**：JD Cloud PostgreSQL 是 Community 数据的唯一写入与权威主库。访客侧边缘 API 与 Cloudflare D1 仅承载只读副本及访客互动计数，不直接承接管理写入。

---

## 2. 前端数据契约 (TypeScript Types)

前端已在 `src/lib/community/types.ts` 定义核心 DTO：

```typescript
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
  title?: string; // 允许无标题（纯动态）或短标题
  content: string; // 原始 Markdown 格式纯文本
  author: CommunityAuthor;
  createdAt: string; // ISO 8601 字符串 (e.g. "2026-10-06T14:30:00Z")
  updatedAt?: string;
  images?: CommunityImage[];
  tags?: string[];
  stats?: CommunityStats;
}

export interface ListCommunityPostsOptions {
  limit?: number;
  offset?: number;
  tag?: string;
}

export interface ListCommunityPostsResult {
  posts: CommunityPost[];
  total: number;
}
```

---

## 3. 边缘 Public API 规范 (Cloudflare Pages Functions)

未来接入真实数据时，边缘 Functions 提供以下两个只读端点：

### 3.1 动态列表 `GET /api/v1/community/posts`

- **请求方式**: `GET`
- **Query 参数**:
  - `limit` (optional, integer, default: `20`, max: `50`): 每页数量
  - `offset` (optional, integer, default: `0`): 偏移量
  - `tag` (optional, string): 按标签筛选
- **响应格式 (JSON)**:

```json
{
  "code": 0,
  "data": {
    "total": 4,
    "posts": [
      {
        "id": "comm_01",
        "slug": "k230-canmv-debug",
        "title": "K230 端侧模型部署与摄像头帧率踩坑记",
        "content": "折腾了几天 CanMV K230 的模型部署...",
        "author": {
          "name": "Alister",
          "avatar": "/images/profile/avatar.webp"
        },
        "createdAt": "2026-10-06T14:30:00Z",
        "updatedAt": null,
        "images": [
          {
            "url": "https://img.alistereno.top/community/k230-board.webp",
            "alt": "K230 开发板调试环境",
            "width": 1200,
            "height": 800
          }
        ],
        "tags": ["K230", "嵌入式", "边缘AI"],
        "stats": {
          "likes": 5,
          "comments": 2
        }
      }
    ]
  }
}
```

### 3.2 动态详情 `GET /api/v1/community/posts/:slug`

- **请求方式**: `GET`
- **Path 参数**:
  - `slug` (string, required): 动态的唯一 slug
- **响应格式 (JSON)**:

```json
{
  "code": 0,
  "data": {
    "id": "comm_01",
    "slug": "k230-canmv-debug",
    "title": "K230 端侧模型部署与摄像头帧率踩坑记",
    "content": "折腾了几天 CanMV K230 的模型部署...",
    "author": {
      "name": "Alister",
      "avatar": "/images/profile/avatar.webp"
    },
    "createdAt": "2026-10-06T14:30:00Z",
    "updatedAt": null,
    "images": [
      {
        "url": "https://img.alistereno.top/community/k230-board.webp",
        "alt": "K230 开发板调试环境"
      }
    ],
    "tags": ["K230", "嵌入式", "边缘AI"],
    "stats": {
      "likes": 5,
      "comments": 2
    }
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
