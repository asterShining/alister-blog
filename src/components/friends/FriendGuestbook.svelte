<script lang="ts">
import Icon from "@iconify/svelte";
import { FRIENDS_GUESTBOOK_SLUG } from "../../lib/friends/self-link";

const sitekey = import.meta.env.PUBLIC_TURNSTILE_SITE_KEY || "1x00000000000000000000AA";
const apiBase = `${import.meta.env.BASE_URL}api/v1/`;
</script>

<section class="friend-guestbook" aria-labelledby="friend-guestbook-title" data-guestbook-section>
	<div class="friend-guestbook__card">
		<alister-post-comments
			data-slug={FRIENDS_GUESTBOOK_SLUG}
			data-api-base={apiBase}
			data-sitekey={sitekey}
			data-variant="guestbook"
		>
			<!-- 头部标题行与引导小文案 -->
			<div class="friend-guestbook__header">
				<div class="friend-guestbook__badge">
					<Icon icon="material-symbols:forum-outline-rounded" class="friend-guestbook__badge-icon" aria-hidden="true" />
					<h2 id="friend-guestbook-title" class="friend-guestbook__title">
						<span class="friend-guestbook__title-text">留言板</span>
						<span data-comment-count class="friend-guestbook__count">留言 0</span>
					</h2>
				</div>
				<p class="friend-guestbook__hint">路过的话，欢迎留下一句话。</p>
			</div>

			<!-- 留言列表 -->
			<div data-comment-list class="friend-guestbook__list" role="feed" aria-label="留言列表">
				<p class="comment-section__empty">正在加载留言…</p>
			</div>

			<hr class="friend-guestbook__divider" />

			<!-- 留言表单 -->
			<div class="friend-guestbook__form-container">
				<h3 class="friend-guestbook__form-title">留下足迹</h3>
				<form class="friend-guestbook__form" onsubmit={(e) => e.preventDefault()}>
					<div class="friend-guestbook__field">
						<label for={`comment-author-${FRIENDS_GUESTBOOK_SLUG}`} class="friend-guestbook__label">昵称</label>
						<input
							id={`comment-author-${FRIENDS_GUESTBOOK_SLUG}`}
							type="text"
							data-comment-name
							maxlength="32"
							class="friend-guestbook__input"
							placeholder="你的昵称（1-32字符）"
							autocomplete="name"
						/>
					</div>
					<div class="friend-guestbook__field">
						<label for={`comment-content-${FRIENDS_GUESTBOOK_SLUG}`} class="friend-guestbook__label">留言</label>
						<textarea
							id={`comment-content-${FRIENDS_GUESTBOOK_SLUG}`}
							data-comment-content
							maxlength="1000"
							rows="3"
							class="friend-guestbook__textarea"
							placeholder="路过的话，欢迎留下一句话…（1-1000字符）"
						></textarea>
					</div>
					<div data-turnstile class="friend-guestbook__turnstile"></div>
					<div class="friend-guestbook__actions">
						<span data-comment-status class="friend-guestbook__status" role="status" aria-live="polite"></span>
						<button type="submit" data-comment-submit class="friend-guestbook__submit-btn" disabled>
							发布留言
						</button>
					</div>
				</form>
			</div>
		</alister-post-comments>
	</div>
</section>

<style>
.friend-guestbook {
	display: block;
	margin-top: 2rem;
}

.friend-guestbook__card {
	border-radius: var(--shape-corner-l, 1rem);
	background: var(--theme-aux-surface, var(--surface-container-low));
	border: 1px solid var(--theme-aux-outline, var(--outline-variant));
	box-shadow: var(--theme-aux-shadow, var(--m3e-elevation-1));
	backdrop-filter: var(--theme-aux-glass-filter, blur(12px) saturate(115%));
	-webkit-backdrop-filter: var(--theme-aux-glass-filter, blur(12px) saturate(115%));
	padding: 1.25rem 1.5rem;
	transition: border-color var(--m3e-duration-medium) var(--m3e-easing-standard),
		box-shadow var(--m3e-duration-medium) var(--m3e-easing-standard);
}

alister-post-comments {
	display: block;
	width: 100%;
}

.friend-guestbook__header {
	display: flex;
	flex-direction: column;
	gap: 0.25rem;
	margin-bottom: 1.25rem;
}

@media (min-width: 640px) {
	.friend-guestbook__header {
		flex-direction: row;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}
}

.friend-guestbook__badge {
	display: inline-flex;
	align-items: center;
	gap: 0.5rem;
}

.friend-guestbook__badge-icon {
	width: 1.25rem;
	height: 1.25rem;
	color: var(--primary);
	flex-shrink: 0;
}

.friend-guestbook__title {
	margin: 0;
	display: inline-flex;
	align-items: baseline;
	gap: 0.5rem;
	font-size: 1.125rem;
	font-weight: 700;
	color: var(--on-surface);
	letter-spacing: -0.01em;
}

.friend-guestbook__count {
	font-size: 0.8125rem;
	font-weight: 500;
	color: var(--on-surface-variant);
}

.friend-guestbook__hint {
	margin: 0;
	font-size: 0.8125rem;
	color: var(--on-surface-variant);
	line-height: 1.4;
}

.friend-guestbook__list {
	display: flex;
	flex-direction: column;
	gap: 0.75rem;
	margin-bottom: 1.5rem;
}

:global(.friend-guestbook .comment-section__empty) {
	font-size: 0.875rem;
	color: var(--on-surface-variant);
	margin: 0.5rem 0;
}

:global(.friend-guestbook .comment-item) {
	display: flex;
	gap: 0.75rem;
	padding: 0.875rem 1rem;
	border-radius: var(--shape-corner-m, 0.75rem);
	background: color-mix(in srgb, var(--surface-container-high) 45%, transparent);
	border: 1px solid var(--outline-variant);
	transition: background-color 180ms, border-color 180ms;
}

:global(.friend-guestbook .comment-item__avatar) {
	width: 2.25rem;
	height: 2.25rem;
	border-radius: var(--shape-corner-full, 9999px);
	background: var(--primary-container);
	color: var(--on-primary-container);
	display: flex;
	align-items: center;
	justify-content: center;
	font-weight: 600;
	font-size: 0.875rem;
	flex-shrink: 0;
	user-select: none;
}

:global(.friend-guestbook .comment-item__content) {
	flex: 1;
	min-width: 0;
}

:global(.friend-guestbook .comment-item__header) {
	display: flex;
	align-items: baseline;
	justify-content: space-between;
	gap: 0.5rem;
	margin-bottom: 0.25rem;
}

:global(.friend-guestbook .comment-item__name) {
	font-weight: 600;
	font-size: 0.9375rem;
	color: var(--on-surface);
	overflow-wrap: anywhere;
	word-break: break-all;
}

:global(.friend-guestbook .comment-item__time) {
	font-size: 0.75rem;
	color: var(--on-surface-variant);
	flex-shrink: 0;
}

:global(.friend-guestbook .comment-item__body) {
	margin: 0;
	font-size: 0.875rem;
	line-height: 1.6;
	color: var(--on-surface);
	white-space: pre-wrap;
	overflow-wrap: anywhere;
	word-break: break-word;
}

.friend-guestbook__divider {
	border: none;
	border-top: 1px solid var(--outline-variant);
	margin: 1.5rem 0;
}

.friend-guestbook__form-container {
	margin-top: 0.5rem;
}

.friend-guestbook__form-title {
	font-size: 1rem;
	font-weight: 600;
	color: var(--on-surface);
	margin: 0 0 1rem;
}

.friend-guestbook__form {
	display: flex;
	flex-direction: column;
	gap: 0.875rem;
}

.friend-guestbook__field {
	display: flex;
	flex-direction: column;
	gap: 0.375rem;
}

.friend-guestbook__label {
	font-size: 0.8125rem;
	font-weight: 500;
	color: var(--on-surface-variant);
}

.friend-guestbook__input,
.friend-guestbook__textarea {
	width: 100%;
	padding: 0.625rem 0.875rem;
	border-radius: var(--shape-corner-m, 0.75rem);
	border: 1px solid var(--outline-variant);
	background: color-mix(in srgb, var(--surface-container-highest) 45%, transparent);
	color: var(--on-surface);
	font-size: 0.875rem;
	font-family: inherit;
	box-sizing: border-box;
	transition: border-color var(--m3e-duration-short) ease,
		box-shadow var(--m3e-duration-short) ease;
}

.friend-guestbook__input:focus,
.friend-guestbook__textarea:focus {
	outline: none;
	border-color: var(--primary);
	box-shadow: 0 0 0 1px var(--primary);
}

.friend-guestbook__textarea {
	resize: vertical;
	min-height: 4.5rem;
}

.friend-guestbook__turnstile {
	min-height: 65px;
	margin: 0.25rem 0;
}

.friend-guestbook__actions {
	display: flex;
	align-items: center;
	justify-content: flex-end;
	gap: 1rem;
	flex-wrap: wrap;
}

.friend-guestbook__status {
	font-size: 0.8125rem;
	color: var(--on-surface-variant);
	flex: 1;
	min-width: 0;
}

.friend-guestbook__submit-btn {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	height: 2.375rem;
	padding: 0 1.25rem;
	border-radius: var(--shape-corner-full, 9999px);
	border: 1px solid transparent;
	background: var(--primary);
	color: var(--on-primary);
	font-size: 0.875rem;
	font-weight: 600;
	cursor: pointer;
	box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
	transition: background-color var(--m3e-duration-short) var(--m3e-easing-standard),
		transform var(--m3e-duration-short) var(--m3e-easing-standard),
		opacity var(--m3e-duration-short) ease;
}

.friend-guestbook__submit-btn:hover:not(:disabled) {
	background: color-mix(in srgb, var(--primary) 88%, white);
	box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
}

.friend-guestbook__submit-btn:active:not(:disabled) {
	transform: scale(0.98);
}

.friend-guestbook__submit-btn:focus-visible {
	outline: 2px solid var(--primary);
	outline-offset: 2px;
}

.friend-guestbook__submit-btn:disabled {
	opacity: 0.5;
	cursor: not-allowed;
}

@media (max-width: 639px) {
	.friend-guestbook__card {
		padding: 1rem 0.875rem;
	}

	.friend-guestbook__actions {
		flex-direction: column-reverse;
		align-items: stretch;
	}

	.friend-guestbook__submit-btn {
		width: 100%;
	}
}
</style>
