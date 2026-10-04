import type { I18nConfig } from "@/types/i18nConfig.ts";
import { withUserConfig } from "@/utils/config-overlay.ts";
import I18nKey from "@i18n/i18nKey";

export const i18nConfig: I18nConfig = withUserConfig("i18n", {
	zh_CN: {
		[I18nKey.home]: "首页",
		[I18nKey.archive]: "文章",
		[I18nKey.anime]: "追番",
	},
});
