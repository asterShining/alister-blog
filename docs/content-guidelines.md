# 内容写作规范

## 内容与资源位置

- 正式文章使用 Markdown 或 MDX，存放在 `shirones/content/posts/`。
- 文件名使用小写 `kebab-case`，文件名即默认 slug，例如 `ros-stm32-communication.md` 对应 `/posts/ros-stm32-communication/`。
- 文章图片存放在 `public/images/posts/<slug>/`，正文中使用 `/images/posts/<slug>/image.webp`。
- 一篇文章由一个内容文件和一个同名图片目录组成；发布时无需同步修改其他数据文件。

## Frontmatter 分级

### 发布必填

- `title`：文章标题。
- `published`：发布日期，统一使用不带引号的 `YYYY-MM-DD`。
- `description`：用于列表、搜索、RSS 和分享摘要。Shirone schema 允许省略，但 Alister Blog 发布规范要求填写。

### 推荐

- `image`：封面绝对路径。
- `category`：一个主要分类，例如 `Web`、`Linux`、`嵌入式`、`机器人`、`开发记录` 或 `随笔`。
- `tags`：多个具体主题，例如 `Astro`、`Fedora`、`ROS`。

### 可选

- `updated`：内容实质更新日期。
- `draft`：草稿统一设为 `true`；准备发布时改为 `false`。
- `pinned`：是否置顶。
- `comment`：是否允许评论，默认 `true`。
- `series`、`seriesOrder`：系列 slug 与系列内顺序。
- `lang`：仅在文章语言不同于站点默认语言时填写。

加密文章还支持 `encrypted`、`password`、`passwordHint` 和 `hideHomeContent`，普通文章不使用。`alias` 与 `permalink` 仅用于迁移或特殊链接。`publishedAt`、`updatedAt` 用于精确时间，使用时必须与对应日期一致。`prev*`、`next*` 是内部字段，不应手写。许可协议由全站配置管理，不是文章 frontmatter 字段。

## 发布检查

1. 确认 slug、图片目录和引用路径一致。
2. 每篇文章只设一个 `category`，标签使用稳定名称。
3. 发布前将 `draft` 改为 `false`。
4. 运行 `pnpm exec astro check` 和 `pnpm build`。
