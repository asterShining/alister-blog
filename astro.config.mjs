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
      // Shirone 0.1.5 defaults to auto. This inline head script runs after
      // Shirone's initializer but before body paint, and only handles a new
      // visitor with no stored preference. Its native switch owns later changes.
      injectScript(
        "head-inline",
        `try { if (localStorage.getItem("theme") === null) { localStorage.setItem("theme", "light"); document.documentElement.classList.remove("dark"); document.documentElement.setAttribute("data-theme", "github-light"); } } catch {}`,
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
