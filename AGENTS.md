# Alister Blog Agent Guide

## Project Overview

Alister Blog is an Astro 7 and Svelte 5 static blog using `shirones` 0.1.x as an npm package and pnpm as its package manager. Run commands on this Fedora/Linux repository with `pnpm`, not Windows `.cmd` commands. Read `package.json` before assuming a script exists.

## Architecture and Modification Priority

`node_modules/shirones/` is third-party theme source: never edit or patch it. `shirones/config/` owns site behavior, `shirones/content/` owns Markdown/MDX content, `src/` holds this site's styles and overrides, and `public/` holds static assets. Prefer changes in this order: configuration, CSS/design tokens, small project extensions, then component or layout overrides. Keep Shirone's layout and upgrade path intact; avoid copying a whole theme for one change. Optional features must be inert when disabled: no extra requests, DOM, or bundle cost.

## Branch and Development Workflow

`main` is production; `dev` is the default development branch. Start each task with `git branch --show-current` and `git status`; switch to `dev` for ordinary development and preserve any user changes. Inspect the relevant local code before editing. Keep diffs small and reviewable.

## Theme Architecture

Light uses the Summer Blue skin and Dark uses Starry Night. Both share Shirone's layout, components, routes, and content. Shirone's native `html.dark` class is the only mode authority. Express skins through CSS variables, semantic tokens, and visual layers in `src/styles/themes/`; do not add a parallel theme store or duplicate pages. Shirone's HCT Theme Color and persistence are the source of truth for UI accent colors; keep environment surfaces and imagery separate from the dynamic `--mc-*` accents, and never hard-code accents so broadly that the native picker becomes ineffective. Hero Banner and Page Background are separate visual layers; do not use one image for both unless explicitly requested. The page shell persists through Swup navigation: keep the theme backdrop mounted, give `html` and `body` a theme-matched fallback color, and never replay a theme switch during navigation or expose a white frame. Preserve usable SSR output and honor reduced-motion preferences.

## Content Architecture

Markdown/MDX under `shirones/content/posts/` is the article source of truth. Use the schema and conventions in `src/content.config.ts`, `docs/content-guidelines.md`, and `docs/post-template.md`. Name article files with kebab-case slugs and place their images under `public/images/posts/<slug>/`. A future CMS is an editor for these files, not a reason to add a database by default.

## Performance and Validation

Use appropriately sized WebP assets. Avoid large-area strong `backdrop-filter`, full-screen animated blur/filter, gratuitous `will-change` or `translateZ(0)`, and canvas wallpaper animation. Theme transitions should be short, non-blocking, and reduced-motion aware. For build-affecting changes run `pnpm exec astro check` (0 errors) and `pnpm build`. For theme, interaction, Swup, or performance changes run the local production-preview E2E commands in `docs/testing.md`; compare production behavior with `pnpm dev` when performance matters. Do not infer production performance from dev alone.

## Git, CI/CD, and Completion

Use descriptive Conventional Commits, for example `feat(theme): ...`, `fix(content): ...`, `perf(theme): ...`, `ci: ...`, or `docs: ...`. Never force-push, hard-reset, remove unknown branches/commits, or overwrite uncommitted work without explicit authorization. The GitHub Actions workflow defines `ci-build` and `e2e-smoke` for `dev` and `main`, plus `e2e-production` for `main` pushes and PRs targeting `main`; verify these jobs on GitHub before making them required Ruleset checks. Cloudflare Pages Git Integration handles CD, with `main` as the only production branch and `dev` for development/preview. Do not add a second Wrangler production deployment without a new requirement.

Finish with changed files and purpose, validation commands and results, current branch and `git status`, known limitations, and the next useful step. For visual work include tested viewports; for performance work report any dev versus preview difference.
