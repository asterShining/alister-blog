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
