type Reaction = { likes: number; viewerReaction: "like" | "dislike" | null };

class PostInteractions extends HTMLElement {
  private controller?: AbortController;
  private ready = false;
  private liked = false;
  private busy = false;
  private likes = 0;

  connectedCallback() {
    if (this.controller) return;
    this.controller = new AbortController();
    this.ready = false;
    this.liked = false;
    this.busy = false;
    this.likes = 0;
    this.text("[data-views]", "—");
    this.text("[data-likes]", "—");
    this.text("[data-status]", "");
    this.button.disabled = true;
    this.button.setAttribute("aria-pressed", "false");
    this.button.addEventListener("click", () => void this.toggle(), { signal: this.controller.signal });
    void this.initialize(this.controller);
  }

  disconnectedCallback() {
    this.controller?.abort();
    this.controller = undefined;
  }

  private get button() { return this.querySelector<HTMLButtonElement>("[data-like]")!; }
  private text(selector: string, value: string) { this.querySelector(selector)!.textContent = value; }
  private endpoint(resource: string) { return `${this.dataset.apiBase}${resource}/${encodeURIComponent(this.dataset.slug!)}`; }

  private async request(resource: string, controller: AbortController, method = "GET", body?: unknown): Promise<unknown> {
    const response = await fetch(this.endpoint(resource), {
      method, credentials: "same-origin", signal: controller.signal,
      ...(body === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
    });
    if (!response.ok) throw new Error("Request failed");
    return response.json();
  }

  private reaction(value: unknown) {
    const data = value as Reaction;
    if (!data || !Number.isSafeInteger(data.likes) || data.likes < 0 || !["like", "dislike", null].includes(data.viewerReaction)) throw new Error("Invalid response");
    this.likes = data.likes;
    this.liked = data.viewerReaction === "like";
    this.ready = true;
    this.render();
  }

  private render() {
    this.text("[data-likes]", String(this.likes));
    this.text("[data-heart]", this.liked ? "♥" : "♡");
    this.button.setAttribute("aria-pressed", String(this.liked));
    this.button.setAttribute("aria-label", this.liked ? "取消点赞" : "点赞文章");
  }

  private async initialize(controller: AbortController) {
    // Serialize first-visit requests so both APIs reuse the same HttpOnly visitor cookie.
    try {
      const data = await this.request("views", controller, "POST") as { views: number };
      if (!Number.isSafeInteger(data.views) || data.views < 0) throw new Error("Invalid response");
      if (this.controller === controller) this.text("[data-views]", String(data.views));
    } catch { /* Unavailable views never block article reading. */ }
    if (controller.signal.aborted || this.controller !== controller) return;
    try {
      const data = await this.request("reactions", controller);
      if (this.controller === controller) this.reaction(data);
    }
    catch { if (!controller.signal.aborted) this.text("[data-status]", "点赞暂不可用，点击可重试"); }
    finally { if (this.controller === controller) this.button.disabled = false; }
  }

  private async toggle() {
    const controller = this.controller;
    if (!controller || this.busy) return;
    this.busy = true;
    this.button.disabled = true;
    this.text("[data-status]", "");
    try {
      // If initialization failed, retry reading the actual state before accepting a toggle.
      if (!this.ready) {
        const state = await this.request("reactions", controller);
        if (this.controller !== controller || controller.signal.aborted) return;
        this.reaction(state);
      }
      const result = await this.request("reactions", controller, "PUT", { type: this.liked ? null : "like" });
      if (this.controller === controller) this.reaction(result);
    } catch {
      if (this.controller === controller && !controller.signal.aborted) this.text("[data-status]", "操作失败，请重试");
      // No optimistic mutation: retain the previous count and pressed state.
    } finally {
      if (this.controller === controller) { this.busy = false; this.button.disabled = false; }
    }
  }
}

// Custom-element lifecycle follows actual Swup DOM insertion/removal, without global hooks.
if (!customElements.get("alister-post-interactions")) customElements.define("alister-post-interactions", PostInteractions);
