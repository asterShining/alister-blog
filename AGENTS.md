# Alister Blog Agent Guide

## Project Overview

Alister Blog is an Astro 7 and Svelte 5 static blog using `shirones` 0.1.x as an npm package and pnpm as its package manager. Run commands on this Fedora/Linux repository with `pnpm`, not Windows `.cmd` commands. Read `package.json` before assuming a script exists.

## Architecture and Modification Priority

`node_modules/shirones/` is third-party theme source: never edit or patch it. `shirones/config/` owns site behavior, `shirones/content/` owns Markdown/MDX content, `src/` holds this site's styles and overrides, and `public/` holds static assets. Prefer changes in this order: configuration, CSS/design tokens, small project extensions, then component or layout overrides. Keep Shirone's layout and upgrade path intact; avoid copying a whole theme for one change. Optional features must be inert when disabled: no extra requests, DOM, or bundle cost.

## Branch and Development Workflow

`main` is production; `dev` is the default development branch. Develop on `dev`, validate changes, then use a pull request from `dev` to `main` for production releases. Start each task with `git branch --show-current` and `git status`; switch to `dev` for ordinary development and preserve any user changes. Inspect the relevant local code before editing. Keep diffs small and reviewable.

## Theme Architecture

Light uses the Summer Blue skin and Dark uses Starry Night. Both share Shirone's layout, components, routes, and content. Shirone's native `html.dark` class is the only mode authority. Express skins through CSS variables, semantic tokens, and visual layers in `src/styles/themes/`; do not add a parallel theme store or duplicate pages. Shirone's HCT Theme Color and persistence are the source of truth for UI accent colors; keep environment surfaces and imagery separate from the dynamic `--mc-*` accents, and never hard-code accents so broadly that the native picker becomes ineffective. Hero Banner and Page Background are separate visual layers; do not use one image for both unless explicitly requested. The page shell persists through Swup navigation: keep the theme backdrop mounted, give `html` and `body` a theme-matched fallback color, and never replay a theme switch during navigation or expose a white frame. Preserve usable SSR output and honor reduced-motion preferences.

## Content Architecture

Markdown/MDX under `shirones/content/posts/` is the article source of truth. Use the schema and conventions in `src/content.config.ts`, `docs/content-guidelines.md`, and `docs/post-template.md`. Name article files with kebab-case slugs and place their images under `public/images/posts/<slug>/`. A future CMS is an editor for these files, not a reason to add a database by default.

## Performance and Validation

Use appropriately sized WebP assets. Avoid large-area strong `backdrop-filter`, full-screen animated blur/filter, gratuitous `will-change` or `translateZ(0)`, and canvas wallpaper animation. Theme transitions should be short, non-blocking, and reduced-motion aware. For build-affecting changes run `pnpm exec astro check` (0 errors) and `pnpm build`. For theme, interaction, Swup, or performance changes run the local production-preview E2E commands in `docs/testing.md`; compare production behavior with `pnpm dev` when performance matters. Do not infer production performance from dev alone.

## Git, CI/CD, and Completion

Use descriptive Conventional Commits, for example `feat(theme): ...`, `fix(content): ...`, `perf(theme): ...`, `ci: ...`, or `docs: ...`. Never force-push, hard-reset, remove unknown branches/commits, or overwrite uncommitted work without explicit authorization. GitHub Actions is CI: `ci-build` and `e2e-smoke` run for `dev` and `main`, and `e2e-production` runs for production pushes and PRs targeting `main`; verify these jobs on GitHub before making them required Ruleset checks. Cloudflare Pages Git Integration is CD. `dev` is Development, `main` is Production, and the Production URL is `https://alistereno.top`. Do not add a second Wrangler production deployment without a new requirement.

`package.json`'s `version` is the sole Alister Blog version source and follows stable SemVer: patch for fixes, minor for features, major for breaking or major architectural releases. Use `pnpm release:patch|minor|major` from a clean, synchronized `dev` branch. Release commits go through a `dev` → `main` PR and the existing CI gates. Because the PR uses squash merge, release tags must be created only from the resulting `main` production commit; never tag `dev`. GitHub Release metadata is created from `main` independently of Cloudflare Pages deployment, which remains Cloudflare's responsibility. After squash merge, synchronize `main` back into `dev` with a normal merge and push.

Finish with changed files and purpose, validation commands and results, current branch and `git status`, known limitations, and the next useful step. For visual work include tested viewports; for performance work report any dev versus preview difference.
