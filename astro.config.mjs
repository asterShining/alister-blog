import { defineConfig } from "astro/config";
import shirones from "shirones";

const starryThemeStyles = new URL(
  "./src/styles/themes/starry.css",
  import.meta.url,
).pathname;

const postCommentsScript = new URL(
  "./src/scripts/post-comments.ts",
  import.meta.url,
).pathname;

// Page-scoped chrome sync: keeps the Swup-static archive category bar and the
// top navigation active state correct on first paint and after every visit.
const pageScopedChromeScript = new URL(
  "./src/scripts/page-scoped-chrome.ts",
  import.meta.url,
).pathname;

const starryTheme = {
  name: "alister-blog-starry-theme",
  hooks: {
    "astro:config:setup": ({ injectScript }) => {
      // Shirone 0.1.5 defaults to auto. Use Dark only when no preference exists;
      // keep its native stored preference and an inline root color floor.
      injectScript(
        "head-inline",
        `(() => {
          const root = document.documentElement;
          try {
            if (localStorage.getItem("theme") === null) {
              localStorage.setItem("theme", "dark");
              root.classList.add("dark");
              root.setAttribute("data-theme", "github-dark");
            }
          } catch {}
          const syncRootColor = () => {
            root.style.backgroundColor = root.classList.contains("dark") ? "#050b1d" : "#edf8ff";
          };
          syncRootColor();
          if (window.__alisterRootFallbackBound) return;
          window.__alisterRootFallbackBound = true;
          window.addEventListener("shirone:theme-change", syncRootColor);

          // Attach the inactive skin's wallpaper/Hero artwork once the page is
          // idle. Until then only the active skin's images are requested, which
          // keeps ~350 KB of never-visible art off the critical path. See the
          // matching selectors in src/styles/themes/starry.css.
          const markArtReady = () => root.classList.add("theme-art-ready");
          const afterIdle = () =>
            "requestIdleCallback" in window
              ? window.requestIdleCallback(markArtReady, { timeout: 3000 })
              : window.setTimeout(markArtReady, 200);
          if (document.readyState === "complete") afterIdle();
          else window.addEventListener("load", afterIdle, { once: true });
        })();`,
      );
      injectScript(
        "page-ssr",
        `import ${JSON.stringify(starryThemeStyles)};`,
      );
      injectScript(
        "page",
        `import ${JSON.stringify(postCommentsScript)};`,
      );
      injectScript(
        "page",
        `import ${JSON.stringify(pageScopedChromeScript)};`,
      );
    },
  },
};

// Site-level settings (site URL, base, title, theme colour, fonts, …) live in
// `shirones/config/` so they stay typed and version-controlled with your
// content. This file only wires the theme in.
export default defineConfig({
  // Keeps the dev/build log free of the empty-`series` warning that shirones
  // still emits while Series is disabled; see `src/logger.mjs`.
  logger: {
    entrypoint: "./src/logger.mjs",
  },
  vite: {
    define: {
      // `shirones/config/communityConfig.ts` is shared by SSR and by client
      // islands (mobile navigation drawer, Community apps), and browsers have
      // no `process.env`. Inline the build-time flag so both sides agree —
      // otherwise the drawer loses the 轨迹 entry after hydration.
      __COMMUNITY_ENABLE__: JSON.stringify(
        process.env.COMMUNITY_ENABLE === "true" ||
          process.env.COMMUNITY_ENABLE === "1",
      ),
    },
  },
  integrations: [
    starryTheme,
    shirones({
      // Override individual components by mirroring the theme's structure in
      // `src/components/`, or point at them explicitly:
      // components: { "atoms/blog/PostCard": "./src/components/PostCard.astro" },
    }),
  ],
});
