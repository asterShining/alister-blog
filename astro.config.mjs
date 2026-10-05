import { defineConfig } from "astro/config";
import shirones from "shirones";

const starryThemeStyles = new URL(
  "./src/styles/themes/starry.css",
  import.meta.url,
).pathname;

const starryTheme = {
  name: "alister-blog-starry-theme",
  hooks: {
    "astro:config:setup": ({ injectScript }) => {
      // Shirone 0.1.5 defaults to auto. Keep its own theme preference and an
      // inline root color floor even if Swup briefly swaps a stylesheet.
      injectScript(
        "head-inline",
        `(() => {
          const root = document.documentElement;
          try {
            if (localStorage.getItem("theme") === null) {
              localStorage.setItem("theme", "light");
              root.classList.remove("dark");
              root.setAttribute("data-theme", "github-light");
            }
          } catch {}
          const syncRootColor = () => {
            root.style.backgroundColor = root.classList.contains("dark") ? "#050b1d" : "#e9f5ff";
          };
          syncRootColor();
          if (window.__alisterRootFallbackBound) return;
          window.__alisterRootFallbackBound = true;
          window.addEventListener("shirone:theme-change", syncRootColor);
        })();`,
      );
      injectScript(
        "page-ssr",
        `import ${JSON.stringify(starryThemeStyles)};`,
      );
    },
  },
};

// Site-level settings (site URL, base, title, theme colour, fonts, …) live in
// `shirones/config/` so they stay typed and version-controlled with your
// content. This file only wires the theme in.
export default defineConfig({
  integrations: [
    starryTheme,
    shirones({
      // Override individual components by mirroring the theme's structure in
      // `src/components/`, or point at them explicitly:
      // components: { "atoms/blog/PostCard": "./src/components/PostCard.astro" },
    }),
  ],
});
