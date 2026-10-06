/**
 * Custom element for article comments: list, form, and Turnstile lifecycle.
 * Follows the same Swup-compatible pattern as PostInteractions:
 * connectedCallback/disconnectedCallback with AbortController.
 */
export {};

declare global {
  interface Window {
    turnstile?: {
      render: (container: string | HTMLElement, options: Record<string, unknown>) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
      getResponse?: (widgetId?: string) => string;
    };
  }
}

interface CommentData {
  id: string;
  authorName: string;
  content: string;
  createdAt: string;
}

/** Ensure the Turnstile API script is loaded exactly once across navigations. */
let turnstileLoading: Promise<void> | null = null;
function ensureTurnstileScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (turnstileLoading) return turnstileLoading;
  turnstileLoading = new Promise<void>((resolve, reject) => {
    if (document.querySelector('script[src*="challenges.cloudflare.com/turnstile"]')) {
      // Script tag exists but hasn't loaded yet
      const check = () => { if (window.turnstile) resolve(); else setTimeout(check, 50); };
      check();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.onload = () => {
      const check = () => { if (window.turnstile) resolve(); else setTimeout(check, 50); };
      check();
    };
    script.onerror = () => { turnstileLoading = null; reject(new Error('Failed to load Turnstile')); };
    document.head.appendChild(script);
  });
  return turnstileLoading;
}

class PostComments extends HTMLElement {
  private controller?: AbortController;
  private widgetId?: string;
  private submitting = false;

  connectedCallback() {
    if (this.controller) return;
    this.controller = new AbortController();
    this.submitting = false;
    this.widgetId = undefined;

    // Reset UI
    if (this.listEl) this.listEl.innerHTML = '';
    if (this.countEl) this.countEl.textContent = '…';
    if (this.statusEl) this.statusEl.textContent = '';
    if (this.submitBtn) this.submitBtn.disabled = true;

    // Restore saved nickname
    const saved = localStorage.getItem('alister_comment_author');
    if (saved && this.nameInput) this.nameInput.value = saved;

    void this.initialize(this.controller);
  }

  disconnectedCallback() {
    if (this.widgetId && window.turnstile) {
      try { window.turnstile.remove(this.widgetId); } catch { /* noop */ }
    }
    this.widgetId = undefined;
    this.controller?.abort();
    this.controller = undefined;
  }

  // --- DOM accessors ---
  private get listEl() { return this.querySelector<HTMLElement>('[data-comment-list]')!; }
  private get countEl() { return this.querySelector<HTMLElement>('[data-comment-count]')!; }
  private get nameInput() { return this.querySelector<HTMLInputElement>('[data-comment-name]')!; }
  private get contentInput() { return this.querySelector<HTMLTextAreaElement>('[data-comment-content]')!; }
  private get submitBtn() { return this.querySelector<HTMLButtonElement>('[data-comment-submit]')!; }
  private get statusEl() { return this.querySelector<HTMLElement>('[data-comment-status]')!; }
  private get turnstileContainer() { return this.querySelector<HTMLElement>('[data-turnstile]')!; }
  private get slug() { return this.dataset.slug!; }
  private get apiBase() { return this.dataset.apiBase!; }
  private get sitekey() { return this.dataset.sitekey!; }

  private endpoint() { return `${this.apiBase}comments/${encodeURIComponent(this.slug)}`; }

  // --- Initialization ---
  private async initialize(controller: AbortController) {
    // Load comments
    try {
      const response = await fetch(this.endpoint(), {
        credentials: 'same-origin',
        signal: controller.signal,
      });
      if (!response.ok) throw new Error('Failed to load');
      const comments: CommentData[] = await response.json();
      if (this.controller !== controller) return;
      this.renderComments(comments);
    } catch {
      if (controller.signal.aborted) return;
      this.countEl.textContent = '评论';
      this.listEl.innerHTML = '';
      const msg = document.createElement('p');
      msg.className = 'comment-section__empty';
      msg.textContent = '评论加载失败，请刷新页面重试。';
      this.listEl.appendChild(msg);
    }

    if (controller.signal.aborted || this.controller !== controller) return;

    // Setup Turnstile
    try {
      await ensureTurnstileScript();
      if (controller.signal.aborted || this.controller !== controller) return;
      this.mountTurnstile();
    } catch {
      if (!controller.signal.aborted) {
        this.statusEl.textContent = '验证组件加载失败，请刷新页面。';
      }
    }

    if (this.controller !== controller) return;

    // Setup form
    this.submitBtn.disabled = false;
    this.submitBtn.addEventListener('click', (e) => {
      e.preventDefault();
      void this.handleSubmit();
    }, { signal: controller.signal });
  }

  // --- Turnstile widget ---
  private mountTurnstile() {
    if (!window.turnstile || !this.turnstileContainer) return;
    // Clear previous widget if any
    this.turnstileContainer.innerHTML = '';
    this.widgetId = window.turnstile.render(this.turnstileContainer, {
      sitekey: this.sitekey,
      action: 'comment_submit',
      theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
      callback: () => { /* token received, submit is ready */ },
      'error-callback': () => {
        this.statusEl.textContent = '验证失败，请重试。';
      },
    });
  }

  // --- Render comments ---
  private renderComments(comments: CommentData[]) {
    this.countEl.textContent = `评论 ${comments.length}`;
    this.listEl.innerHTML = '';

    if (comments.length === 0) {
      const msg = document.createElement('p');
      msg.className = 'comment-section__empty';
      msg.textContent = '暂无评论，来说点什么吧。';
      this.listEl.appendChild(msg);
      return;
    }

    for (const comment of comments) {
      this.listEl.appendChild(this.createCommentEl(comment));
    }
  }

  private createCommentEl(comment: CommentData): HTMLElement {
    const article = document.createElement('article');
    article.className = 'comment-item';

    const avatar = document.createElement('div');
    avatar.className = 'comment-item__avatar';
    // First letter avatar — safe because authorName is already validated server-side
    avatar.textContent = [...comment.authorName][0]?.toUpperCase() ?? '?';

    const header = document.createElement('div');
    header.className = 'comment-item__header';

    const name = document.createElement('span');
    name.className = 'comment-item__name';
    name.textContent = comment.authorName;  // textContent, never innerHTML

    const time = document.createElement('time');
    time.className = 'comment-item__time';
    time.dateTime = comment.createdAt;
    time.textContent = this.formatDate(comment.createdAt);

    header.appendChild(name);
    header.appendChild(time);

    const body = document.createElement('p');
    body.className = 'comment-item__body';
    body.textContent = comment.content;  // textContent, never innerHTML

    article.appendChild(avatar);
    const content = document.createElement('div');
    content.className = 'comment-item__content';
    content.appendChild(header);
    content.appendChild(body);
    article.appendChild(content);

    return article;
  }

  private formatDate(iso: string): string {
    try {
      const date = new Date(iso);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    } catch { return iso; }
  }

  // --- Form submission ---
  private async handleSubmit() {
    if (this.submitting || !this.controller) return;
    this.statusEl.textContent = '';

    const authorName = this.nameInput.value.trim();
    const content = this.contentInput.value.trim();

    if ([...authorName].length < 1 || [...authorName].length > 32) {
      this.statusEl.textContent = '昵称长度应为 1-32 个字符。';
      return;
    }
    if ([...content].length < 1 || [...content].length > 1000) {
      this.statusEl.textContent = '评论内容应为 1-1000 个字符。';
      return;
    }

    // Get Turnstile token
    const tokenFromApi = this.widgetId && window.turnstile?.getResponse ? window.turnstile.getResponse(this.widgetId) : '';
    const tokenInput = this.turnstileContainer?.querySelector<HTMLInputElement>('[name="cf-turnstile-response"]');
    const turnstileToken = tokenFromApi || tokenInput?.value;
    if (!turnstileToken) {
      this.statusEl.textContent = '请先完成人机验证。';
      return;
    }

    this.submitting = true;
    this.submitBtn.disabled = true;
    this.statusEl.textContent = '提交中…';

    try {
      const response = await fetch(this.endpoint(), {
        method: 'POST',
        credentials: 'same-origin',
        signal: this.controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authorName, content, turnstileToken }),
      });

      if (response.status === 429) {
        this.statusEl.textContent = '操作太频繁，请稍后再试。';
        this.resetTurnstile();
        return;
      }
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        this.statusEl.textContent = data?.error ?? '发表评论失败，请重试。';
        this.resetTurnstile();
        return;
      }

      const newComment: CommentData = await response.json();

      // Save nickname
      localStorage.setItem('alister_comment_author', authorName);

      // Append new comment to list
      const emptyMsg = this.listEl.querySelector('.comment-section__empty');
      if (emptyMsg) emptyMsg.remove();
      this.listEl.appendChild(this.createCommentEl(newComment));

      // Update count
      const existing = this.listEl.querySelectorAll('.comment-item').length;
      this.countEl.textContent = `评论 ${existing}`;

      // Clear content, keep nickname
      this.contentInput.value = '';
      this.statusEl.textContent = '评论发表成功！';

      // Reset Turnstile for next submission (tokens are single-use)
      this.resetTurnstile();
    } catch {
      if (!this.controller?.signal.aborted) {
        this.statusEl.textContent = '发表评论失败，请重试。';
        this.resetTurnstile();
      }
    } finally {
      this.submitting = false;
      if (this.controller && !this.controller.signal.aborted) {
        this.submitBtn.disabled = false;
      }
    }
  }

  private resetTurnstile() {
    if (this.widgetId && window.turnstile) {
      try { window.turnstile.reset(this.widgetId); } catch { /* noop */ }
    }
  }
}

if (!customElements.get('alister-post-comments')) {
  customElements.define('alister-post-comments', PostComments);
}
