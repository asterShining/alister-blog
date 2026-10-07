<script lang="ts">
import Icon from "@iconify/svelte";
import { getOwnerEmail, getFriendApplyMailtoUrl } from "../../lib/friends/self-link";

const ownerEmail = getOwnerEmail();
const mailtoUrl = getFriendApplyMailtoUrl();
</script>

<section class="friend-apply" aria-labelledby="friend-apply-heading">
	<div class="friend-apply__card">
		<!-- 标题行 -->
		<div class="friend-apply__header">
			<div class="friend-apply__badge">
				<Icon icon="material-symbols:mail-outline-rounded" class="friend-apply__badge-icon" aria-hidden="true" />
				<h2 id="friend-apply-heading" class="friend-apply__title">友链申请</h2>
			</div>
		</div>

		<!-- 申请说明文案 -->
		<div class="friend-apply__content">
			<p class="friend-apply__paragraph">
				如果你也想交换友链，欢迎通过邮件联系我。<br />
				申请时请附上博客名称、链接、头像、简介，以及 RSS 地址（如果有）。<br />
				我看到后会尽快处理。
			</p>
			<p class="friend-apply__note">
				本站友链信息可以直接使用上方“一键复制友链信息”。
			</p>
		</div>

		<!-- 操作栏：邮件申请 CTA 与公开邮箱展示 / 复制 -->
		<div class="friend-apply__actions">
			<a
				href={mailtoUrl}
				class="friend-apply__mailto-btn"
				aria-label="邮件申请友链"
			>
				<Icon icon="material-symbols:mail-rounded" class="friend-apply__btn-icon" aria-hidden="true" />
				<span>邮件申请友链</span>
				<svg class="friend-apply__arrow-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
					<line x1="7" y1="17" x2="17" y2="7"></line>
					<polyline points="7 7 17 7 17 17"></polyline>
				</svg>
			</a>

			<div class="friend-apply__email-pill">
				<span class="friend-apply__email-label">公开邮箱</span>
				<a
					href={`mailto:${ownerEmail}`}
					class="friend-apply__email-address"
					aria-label={`发送邮件至 ${ownerEmail}`}
				>
					{ownerEmail}
				</a>

				<friend-self-link
					class="friend-apply__copy-wrapper"
					data-copy-text={ownerEmail}
				>
					<button
						type="button"
						class="friend-apply__copy-btn"
						data-copy-btn
						aria-label="复制站长邮箱"
					>
						<span class="friend-apply__icon-box" data-icon-copy aria-hidden="true">
							<Icon icon="material-symbols:content-copy-rounded" class="friend-apply__icon" />
						</span>
						<span class="friend-apply__icon-box" data-icon-check aria-hidden="true" hidden>
							<Icon icon="material-symbols:check-rounded" class="friend-apply__icon" />
						</span>
						<span data-copy-label>复制邮箱</span>
					</button>
					<span class="sr-only" aria-live="polite" data-copy-status></span>
				</friend-self-link>
			</div>
		</div>
	</div>
</section>

<style>
.friend-apply {
	display: block;
	margin: 0 0 2rem;
}

.friend-apply__card {
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

.friend-apply__header {
	display: flex;
	align-items: center;
	margin-bottom: 0.75rem;
}

.friend-apply__badge {
	display: inline-flex;
	align-items: center;
	gap: 0.5rem;
}

.friend-apply__badge-icon {
	width: 1.125rem;
	height: 1.125rem;
	color: var(--primary);
	flex-shrink: 0;
}

.friend-apply__title {
	margin: 0;
	font-size: 1rem;
	font-weight: 700;
	color: var(--on-surface);
	letter-spacing: -0.01em;
}

.friend-apply__content {
	display: flex;
	flex-direction: column;
	gap: 0.5rem;
	margin-bottom: 1.125rem;
}

.friend-apply__paragraph {
	margin: 0;
	font-size: 0.875rem;
	line-height: 1.6;
	color: var(--on-surface-variant);
}

.friend-apply__note {
	margin: 0;
	font-size: 0.8125rem;
	line-height: 1.5;
	color: var(--primary);
	opacity: 0.9;
}

.friend-apply__actions {
	display: flex;
	flex-direction: column;
	gap: 0.75rem;
	align-items: stretch;
}

@media (min-width: 640px) {
	.friend-apply__actions {
		flex-direction: row;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
	}
}

.friend-apply__mailto-btn {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	gap: 0.5rem;
	height: 2.375rem;
	padding: 0 1.25rem;
	border-radius: var(--shape-corner-full, 9999px);
	border: 1px solid transparent;
	background: var(--primary);
	color: var(--on-primary);
	font-size: 0.875rem;
	font-weight: 600;
	text-decoration: none;
	cursor: pointer;
	box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
	transition: background-color var(--m3e-duration-short) var(--m3e-easing-standard),
		transform var(--m3e-duration-short) var(--m3e-easing-standard),
		box-shadow var(--m3e-duration-short) var(--m3e-easing-standard);
	user-select: none;
}

.friend-apply__mailto-btn:hover {
	background: color-mix(in srgb, var(--primary) 88%, white);
	box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
}

.friend-apply__mailto-btn:active {
	transform: scale(0.98);
}

.friend-apply__mailto-btn:focus-visible {
	outline: 2px solid var(--primary);
	outline-offset: 2px;
}

.friend-apply__btn-icon {
	width: 1.125rem;
	height: 1.125rem;
	flex-shrink: 0;
}

.friend-apply__arrow-icon {
	width: 0.75rem;
	height: 0.75rem;
	flex-shrink: 0;
	opacity: 0.85;
}

.friend-apply__email-pill {
	display: inline-flex;
	align-items: center;
	gap: 0.625rem;
	padding: 0.25rem 0.5rem 0.25rem 0.875rem;
	border-radius: var(--shape-corner-full, 9999px);
	background: color-mix(in srgb, var(--surface-container-highest) 45%, transparent);
	border: 1px solid var(--outline-variant);
	font-size: 0.8125rem;
	min-width: 0;
	flex-wrap: wrap;
}

@media (max-width: 639px) {
	.friend-apply__email-pill {
		justify-content: space-between;
		padding: 0.375rem 0.625rem 0.375rem 0.875rem;
	}
}

.friend-apply__email-label {
	color: var(--on-surface-variant);
	font-size: 0.75rem;
	user-select: none;
	flex-shrink: 0;
}

.friend-apply__email-address {
	color: var(--on-surface);
	font-family: var(--m3e-font-mono-family, monospace);
	font-weight: 500;
	text-decoration: none;
	transition: color var(--m3e-duration-short) ease;
	word-break: break-all;
}

.friend-apply__email-address:hover {
	color: var(--primary);
	text-decoration: underline;
}

.friend-apply__copy-wrapper {
	display: inline-flex;
	align-items: center;
	flex-shrink: 0;
}

.friend-apply__copy-btn {
	display: inline-flex;
	align-items: center;
	gap: 0.25rem;
	height: 1.75rem;
	padding: 0 0.625rem;
	border-radius: var(--shape-corner-full, 9999px);
	border: 1px solid var(--outline-variant);
	background: color-mix(in srgb, var(--surface-container-high) 60%, transparent);
	color: var(--on-surface);
	font-size: 0.75rem;
	font-weight: 500;
	cursor: pointer;
	user-select: none;
	transition: background-color var(--m3e-duration-short) ease,
		border-color var(--m3e-duration-short) ease,
		color var(--m3e-duration-short) ease;
}

.friend-apply__copy-btn:hover:not(.friend-self-link__copy-btn--copied) {
	background: color-mix(in srgb, var(--primary) 12%, transparent);
	border-color: var(--primary);
	color: var(--primary);
}

.friend-apply__copy-btn:focus-visible {
	outline: 2px solid var(--primary);
	outline-offset: 2px;
}

:global(.friend-apply__copy-btn.friend-self-link__copy-btn--copied) {
	background: var(--secondary, #397d96);
	color: var(--on-primary);
	border-color: transparent;
}

.friend-apply__icon-box {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
}

.friend-apply__icon-box[hidden] {
	display: none !important;
}

.friend-apply__icon {
	width: 0.875rem;
	height: 0.875rem;
	flex-shrink: 0;
}

@media (max-width: 639px) {
	.friend-apply__card {
		padding: 1rem 0.875rem;
	}
}
</style>
