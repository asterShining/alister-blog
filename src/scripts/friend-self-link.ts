/**
 * Custom element for Friend Self Link card copy button.
 * Uses connectedCallback/disconnectedCallback with AbortController for clean lifecycle
 * and zero listener leaks across Swup page navigations.
 */
export class FriendSelfLinkElement extends HTMLElement {
  private controller?: AbortController;
  private resetTimer?: number;

  connectedCallback() {
    if (this.controller) return;
    this.controller = new AbortController();

    const button = this.querySelector<HTMLButtonElement>("[data-copy-btn]");
    if (!button) return;

    button.addEventListener("click", () => void this.handleCopy(), {
      signal: this.controller.signal,
    });
  }

  disconnectedCallback() {
    this.controller?.abort();
    this.controller = undefined;
    if (this.resetTimer) {
      window.clearTimeout(this.resetTimer);
      this.resetTimer = undefined;
    }
  }

  private async copyToClipboard(text: string): Promise<boolean> {
    if (typeof navigator !== "undefined" && navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        // Fallback to execCommand if permission rejected
      }
    }

    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.top = "-9999px";
      textarea.style.left = "-9999px";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const success = document.execCommand("copy");
      document.body.removeChild(textarea);
      return success;
    } catch {
      return false;
    }
  }

  private async handleCopy() {
    const button = this.querySelector<HTMLButtonElement>("[data-copy-btn]");
    const labelEl = this.querySelector<HTMLElement>("[data-copy-label]");
    const iconCopy = this.querySelector<HTMLElement>("[data-icon-copy]");
    const iconCheck = this.querySelector<HTMLElement>("[data-icon-check]");
    const statusEl = this.querySelector<HTMLElement>("[data-copy-status]");
    const copyData = this.getAttribute("data-copy-text") || button?.dataset.copyText;
    if (!button || !copyData) return;

    const originalLabel = labelEl?.textContent?.trim() || "一键复制友链信息";
    const originalAriaLabel = button.getAttribute("aria-label") || originalLabel;
    const isEmailCopy = copyData.includes("@") && !copyData.includes("\n");
    const successStatus = isEmailCopy
      ? "邮箱地址已成功复制到剪贴板"
      : "友链信息已成功复制到剪贴板";
    const successAria = isEmailCopy ? "已复制邮箱" : "已复制友链信息";

    const success = await this.copyToClipboard(copyData);

    if (this.resetTimer) {
      window.clearTimeout(this.resetTimer);
      this.resetTimer = undefined;
    }

    if (success) {
      button.classList.add("friend-self-link__copy-btn--copied");
      button.setAttribute("aria-label", successAria);
      if (labelEl) labelEl.textContent = "已复制";
      if (iconCopy) iconCopy.hidden = true;
      if (iconCheck) iconCheck.hidden = false;
      if (statusEl) statusEl.textContent = successStatus;

      this.resetTimer = window.setTimeout(() => {
        button.classList.remove("friend-self-link__copy-btn--copied");
        button.setAttribute("aria-label", originalAriaLabel);
        if (labelEl) labelEl.textContent = originalLabel;
        if (iconCopy) iconCopy.hidden = false;
        if (iconCheck) iconCheck.hidden = true;
        if (statusEl) statusEl.textContent = "";
        this.resetTimer = undefined;
      }, 2000);
    } else {
      button.classList.add("friend-self-link__copy-btn--failed");
      if (labelEl) labelEl.textContent = "复制失败，请手动复制";
      if (statusEl) statusEl.textContent = "复制失败，请手动复制";

      this.resetTimer = window.setTimeout(() => {
        button.classList.remove("friend-self-link__copy-btn--failed");
        button.setAttribute("aria-label", originalAriaLabel);
        if (labelEl) labelEl.textContent = originalLabel;
        if (statusEl) statusEl.textContent = "";
        this.resetTimer = undefined;
      }, 3000);
    }
  }
}

if (typeof window !== "undefined" && !customElements.get("friend-self-link")) {
  customElements.define("friend-self-link", FriendSelfLinkElement);
}
