/**
 * Safe, zero-dependency Markdown renderer for Community posts.
 * Focuses on security (strict HTML escaping and URL sanitization)
 * and lightweight presentation (paragraphs, headings, lists, quotes, code, links).
 */

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isSafeUrl(url: string): boolean {
  const trimmed = url.trim().toLowerCase();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return true;
  }
  if (trimmed.startsWith("/") || trimmed.startsWith("#")) {
    return true;
  }
  return false;
}

export function renderInlineMarkdown(escapedText: string): string {
  // 1. Extract inline code tokens first so markdown syntax inside code is preserved literally.
  // Use tokens without underscores to avoid interfering with markdown italic parsing.
  const inlineCodeTokens: string[] = [];
  let processed = escapedText.replace(/`([^`\n]+)`/g, (_match, code) => {
    const idx = inlineCodeTokens.length;
    inlineCodeTokens.push(
      `<code class="community-inline-code">${code}</code>`,
    );
    return `%%INLINETOKEN${idx}%%`;
  });

  // 2. Links: [text](url)
  processed = processed.replace(
    /\[([^\]]+)\]\(([^)\s]+)\)/g,
    (_match, text, url) => {
      const rawUrl = url.replace(/&amp;/g, "&");
      if (isSafeUrl(rawUrl)) {
        return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="community-link">${text}</a>`;
      }
      return text;
    },
  );

  // 3. Bold: **text** or __text__
  processed = processed.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  processed = processed.replace(/__([^_]+)__/g, "<strong>$1</strong>");

  // 4. Italic: *text* or _text_
  processed = processed.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "<em>$1</em>");
  processed = processed.replace(/(?<!_)_([^_]+)_(?!_)/g, "<em>$1</em>");

  // 5. Single line breaks -> <br />
  processed = processed.replace(/\n/g, "<br />");

  // 6. Restore inline code
  processed = processed.replace(/%%INLINETOKEN(\d+)%%/g, (_m, id) => {
    return inlineCodeTokens[Number(id)] ?? "";
  });

  return processed;
}

export function renderCommunityMarkdown(markdown: string): string {
  if (!markdown || typeof markdown !== "string") {
    return "";
  }

  // Normalize line breaks
  const normalized = markdown.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // 1. Extract fenced code blocks
  const codeBlockTokens: string[] = [];
  const withCodePlaceholders = normalized.replace(
    /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g,
    (_match, lang, code) => {
      const idx = codeBlockTokens.length;
      const escapedCode = escapeHtml(code.trimEnd());
      const langClass = lang ? ` data-lang="${escapeHtml(lang)}"` : "";
      codeBlockTokens.push(
        `<pre class="community-codeblock"><code${langClass}>${escapedCode}</code></pre>`,
      );
      return `\n\n%%CODEBLOCKTOKEN${idx}%%\n\n`;
    },
  );

  const lines = withCodePlaceholders.split("\n");
  const renderedBlocks: string[] = [];

  let currentParaLines: string[] = [];
  let currentUlLines: string[] = [];
  let currentOlLines: string[] = [];
  let currentQuoteLines: string[] = [];

  const flushParagraph = () => {
    if (currentParaLines.length > 0) {
      const text = currentParaLines.join("\n");
      renderedBlocks.push(
        `<p class="community-p">${renderInlineMarkdown(escapeHtml(text))}</p>`,
      );
      currentParaLines = [];
    }
  };

  const flushUl = () => {
    if (currentUlLines.length > 0) {
      const items = currentUlLines.map(
        (li) => `<li>${renderInlineMarkdown(escapeHtml(li))}</li>`,
      );
      renderedBlocks.push(
        `<ul class="community-list community-list--ul">${items.join("")}</ul>`,
      );
      currentUlLines = [];
    }
  };

  const flushOl = () => {
    if (currentOlLines.length > 0) {
      const items = currentOlLines.map(
        (li) => `<li>${renderInlineMarkdown(escapeHtml(li))}</li>`,
      );
      renderedBlocks.push(
        `<ol class="community-list community-list--ol">${items.join("")}</ol>`,
      );
      currentOlLines = [];
    }
  };

  const flushQuote = () => {
    if (currentQuoteLines.length > 0) {
      const text = currentQuoteLines.join("\n");
      renderedBlocks.push(
        `<blockquote class="community-blockquote"><p>${renderInlineMarkdown(escapeHtml(text))}</p></blockquote>`,
      );
      currentQuoteLines = [];
    }
  };

  const flushAll = () => {
    flushParagraph();
    flushUl();
    flushOl();
    flushQuote();
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    // Check code placeholder
    const codeMatch = line.trim().match(/^%%CODEBLOCKTOKEN(\d+)%%$/);
    if (codeMatch) {
      flushAll();
      const idx = Number(codeMatch[1]);
      renderedBlocks.push(codeBlockTokens[idx] ?? "");
      continue;
    }

    // Blank line
    if (!line.trim()) {
      flushAll();
      continue;
    }

    // Heading
    const h3Match = line.match(/^###\s+(.+)$/);
    if (h3Match) {
      flushAll();
      renderedBlocks.push(
        `<h3 class="community-h3">${renderInlineMarkdown(escapeHtml(h3Match[1].trim()))}</h3>`,
      );
      continue;
    }
    const h2Match = line.match(/^##\s+(.+)$/);
    if (h2Match) {
      flushAll();
      renderedBlocks.push(
        `<h2 class="community-h2">${renderInlineMarkdown(escapeHtml(h2Match[1].trim()))}</h2>`,
      );
      continue;
    }
    const h1Match = line.match(/^#\s+(.+)$/);
    if (h1Match) {
      flushAll();
      renderedBlocks.push(
        `<h1 class="community-h1">${renderInlineMarkdown(escapeHtml(h1Match[1].trim()))}</h1>`,
      );
      continue;
    }

    // Blockquote
    const quoteMatch = line.match(/^>\s?(.*)$/);
    if (quoteMatch) {
      flushParagraph();
      flushUl();
      flushOl();
      currentQuoteLines.push(quoteMatch[1]);
      continue;
    }

    // Unordered list
    const ulMatch = line.match(/^[-*]\s+(.+)$/);
    if (ulMatch) {
      flushParagraph();
      flushOl();
      flushQuote();
      currentUlLines.push(ulMatch[1]);
      continue;
    }

    // Ordered list
    const olMatch = line.match(/^\d+\.\s+(.+)$/);
    if (olMatch) {
      flushParagraph();
      flushUl();
      flushQuote();
      currentOlLines.push(olMatch[1]);
      continue;
    }

    // Regular line inside paragraph
    flushUl();
    flushOl();
    flushQuote();
    currentParaLines.push(line);
  }

  flushAll();

  return renderedBlocks.join("\n");
}
