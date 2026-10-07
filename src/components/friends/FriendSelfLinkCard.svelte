<script lang="ts">
import Icon from "@iconify/svelte";
import { getSelfLinkInfo, getSelfLinkCopyText } from "../../lib/friends/self-link";

const selfInfo = getSelfLinkInfo();
const copyPayload = getSelfLinkCopyText(selfInfo);
</script>

<friend-self-link
	class="friend-self-link"
	data-copy-text={copyPayload}
>
	<div class="friend-self-link__card">
		<!-- 头部标题行与引导小文案 -->
		<div class="friend-self-link__top">
			<div class="friend-self-link__badge">
				<svg class="friend-self-link__badge-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
					<path fill="currentColor" d="M7 17q-2.075 0-3.537-1.463T2 12t1.463-3.537T7 7h3q.425 0 .713.288T11 8t-.288.713T10 9H7q-1.25 0-2.125.875T4 12t.875 2.125T7 15h3q.425 0 .713.288T11 16t-.288.713T10 17zm2-4q-.425 0-.712-.288T8 12t.288-.712T9 11h6q.425 0 .713.288T16 12t-.288.713T15 13zm5 4q-.425 0-.712-.288T13 16t.288-.712T14 15h3q1.25 0 2.125-.875T20 12t-.875-2.125T17 9h-3q-.425 0-.712-.288T13 8t.288-.712T14 7h3q2.075 0 3.538 1.463T22 12t-1.463 3.538T17 17z"/>
				</svg>
				<span class="friend-self-link__title">我的友链信息</span>
			</div>
			<p class="friend-self-link__hint">
				如果你想添加本站，可以直接复制下面的信息。
			</p>
		</div>

		<!-- 站主身份信息（头像、站名、域名、简介）与一键复制按钮 -->
		<div class="friend-self-link__profile-row">
			<div class="friend-self-link__profile-main">
				<img
					src={selfInfo.avatarDisplay}
					alt={selfInfo.name}
					class="friend-self-link__avatar"
					width="48"
					height="48"
					loading="eager"
					decoding="async"
				/>
				<div class="friend-self-link__profile-meta">
					<div class="friend-self-link__name-row">
						<span class="friend-self-link__name">{selfInfo.name}</span>
						<a
							href={selfInfo.link}
							target="_blank"
							rel="noopener noreferrer"
							class="friend-self-link__host-link"
							aria-label="访问本站主页"
						>
							<span>alistereno.top</span>
							<svg class="friend-self-link__arrow-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
								<line x1="7" y1="17" x2="17" y2="7"></line>
								<polyline points="7 7 17 7 17 17"></polyline>
							</svg>
						</a>
					</div>
					<p class="friend-self-link__desc">{selfInfo.descr}</p>
				</div>
			</div>

			<!-- 复制按钮 -->
			<div class="friend-self-link__action">
				<button
					type="button"
					class="friend-self-link__copy-btn"
					data-copy-btn
					data-copy-text={copyPayload}
					aria-label="一键复制友链信息"
				>
					<span class="friend-self-link__icon-box" data-icon-copy aria-hidden="true">
						<Icon icon="material-symbols:content-copy-rounded" class="friend-self-link__btn-icon" />
					</span>
					<span class="friend-self-link__icon-box" data-icon-check aria-hidden="true" hidden>
						<Icon icon="material-symbols:check-rounded" class="friend-self-link__btn-icon" />
					</span>
					<span data-copy-label>一键复制友链信息</span>
				</button>
				<span class="sr-only" aria-live="polite" data-copy-status></span>
			</div>
		</div>

		<!-- 资料字段区（可读、可选中、可手动复制） -->
		<div class="friend-self-link__code-box" role="region" aria-label="友链数据详情">
			<div class="friend-self-link__field">
				<span class="friend-self-link__key">name</span>
				<span class="friend-self-link__val">{selfInfo.name}</span>
			</div>
			<div class="friend-self-link__field">
				<span class="friend-self-link__key">link</span>
				<span class="friend-self-link__val">{selfInfo.link}</span>
			</div>
			<div class="friend-self-link__field">
				<span class="friend-self-link__key">avatar</span>
				<span class="friend-self-link__val">{selfInfo.avatar}</span>
			</div>
			<div class="friend-self-link__field">
				<span class="friend-self-link__key">descr</span>
				<span class="friend-self-link__val">{selfInfo.descr}</span>
			</div>
			<div class="friend-self-link__field">
				<span class="friend-self-link__key">rss</span>
				<span class="friend-self-link__val">{selfInfo.rss}</span>
			</div>
		</div>
	</div>
</friend-self-link>

<style>
.friend-self-link {
	display: block;
	margin: 1.5rem 0 2rem;
}

.friend-self-link__card {
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

.friend-self-link__top {
	display: flex;
	flex-direction: column;
	gap: 0.25rem;
	margin-bottom: 1rem;
}

@media (min-width: 640px) {
	.friend-self-link__top {
		flex-direction: row;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}
}

.friend-self-link__badge {
	display: inline-flex;
	align-items: center;
	gap: 0.5rem;
}

.friend-self-link__badge-icon {
	width: 1.125rem;
	height: 1.125rem;
	color: var(--primary);
	flex-shrink: 0;
}

.friend-self-link__title {
	font-size: 1rem;
	font-weight: 700;
	color: var(--on-surface);
	letter-spacing: -0.01em;
}

.friend-self-link__hint {
	margin: 0;
	font-size: 0.8125rem;
	color: var(--on-surface-variant);
	line-height: 1.4;
}

.friend-self-link__profile-row {
	display: flex;
	flex-direction: column;
	gap: 1rem;
	margin-bottom: 1rem;
	padding-bottom: 1rem;
	border-bottom: 1px solid var(--outline-variant);
}

@media (min-width: 640px) {
	.friend-self-link__profile-row {
		flex-direction: row;
		align-items: center;
		justify-content: space-between;
	}
}

.friend-self-link__profile-main {
	display: flex;
	align-items: center;
	gap: 0.875rem;
	min-width: 0;
}

.friend-self-link__avatar {
	width: 3rem;
	height: 3rem;
	border-radius: var(--shape-corner-full, 9999px);
	border: 1.5px solid var(--outline-variant);
	object-fit: cover;
	flex-shrink: 0;
	box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
}

.friend-self-link__profile-meta {
	min-width: 0;
	flex: 1;
}

.friend-self-link__name-row {
	display: flex;
	align-items: center;
	gap: 0.5rem;
	flex-wrap: wrap;
}

.friend-self-link__name {
	font-size: 1.0625rem;
	font-weight: 700;
	color: var(--on-surface);
	line-height: 1.3;
}

.friend-self-link__host-link {
	display: inline-flex;
	align-items: center;
	gap: 0.25rem;
	font-size: 0.75rem;
	color: var(--on-surface-variant);
	background: color-mix(in srgb, var(--on-surface) 4%, transparent);
	padding: 0.125rem 0.5rem;
	border-radius: var(--shape-corner-full, 9999px);
	border: 1px solid var(--outline-variant);
	text-decoration: none;
	transition: color var(--m3e-duration-short) ease,
		border-color var(--m3e-duration-short) ease,
		background-color var(--m3e-duration-short) ease;
}

.friend-self-link__host-link:hover {
	color: var(--primary);
	border-color: var(--primary);
	background: color-mix(in srgb, var(--primary) 8%, transparent);
}

.friend-self-link__arrow-icon {
	width: 0.75rem;
	height: 0.75rem;
}

.friend-self-link__desc {
	margin: 0.25rem 0 0;
	font-size: 0.8125rem;
	color: var(--on-surface-variant);
	line-height: 1.4;
}

.friend-self-link__action {
	flex-shrink: 0;
}

@media (max-width: 639px) {
	.friend-self-link__action {
		width: 100%;
	}
}

.friend-self-link__copy-btn {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	gap: 0.5rem;
	height: 2.375rem;
	padding: 0 1.125rem;
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
		box-shadow var(--m3e-duration-short) var(--m3e-easing-standard);
	user-select: none;
}

@media (max-width: 639px) {
	.friend-self-link__copy-btn {
		width: 100%;
	}
}

.friend-self-link__copy-btn:hover:not(.friend-self-link__copy-btn--copied) {
	background: color-mix(in srgb, var(--primary) 88%, white);
	box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
}

.friend-self-link__copy-btn:active:not(.friend-self-link__copy-btn--copied) {
	transform: scale(0.98);
}

.friend-self-link__copy-btn:focus-visible {
	outline: 2px solid var(--primary);
	outline-offset: 2px;
}

:global(.friend-self-link__copy-btn.friend-self-link__copy-btn--copied) {
	background: var(--secondary, #397d96);
	color: var(--on-primary);
	box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

:global(.friend-self-link__copy-btn.friend-self-link__copy-btn--failed) {
	background: #ba1a1a;
	color: #ffffff;
}

.friend-self-link__icon-box {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
}

.friend-self-link__icon-box[hidden] {
	display: none !important;
}

.friend-self-link__btn-icon {
	width: 1.125rem;
	height: 1.125rem;
	flex-shrink: 0;
}

.friend-self-link__code-box {
	border-radius: var(--shape-corner-m, 0.75rem);
	background: color-mix(in srgb, var(--surface-container-highest) 45%, transparent);
	border: 1px solid var(--outline-variant);
	padding: 0.75rem 1rem;
	font-family: var(--m3e-font-mono-family, monospace);
	font-size: 0.8125rem;
	display: flex;
	flex-direction: column;
	gap: 0.375rem;
}

.friend-self-link__field {
	display: flex;
	align-items: baseline;
	gap: 1.25rem;
	min-width: 0;
}

@media (max-width: 480px) {
	.friend-self-link__field {
		gap: 0.75rem;
	}
}

.friend-self-link__key {
	width: 3.5rem;
	flex-shrink: 0;
	color: var(--primary);
	font-weight: 600;
	user-select: none;
}

.friend-self-link__val {
	flex: 1;
	min-width: 0;
	color: var(--on-surface);
	overflow-wrap: anywhere;
	word-break: break-all;
	user-select: text;
	line-height: 1.5;
}

@media (max-width: 639px) {
	.friend-self-link__card {
		padding: 1rem 0.875rem;
	}
}
</style>
