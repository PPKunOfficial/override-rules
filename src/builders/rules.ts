/**
 * 路由规则构建。
 *
 * 规则中引用的规则集名称通过 `ruleSet()` 生成，受 `RuleSetKey` 类型约束，
 * 不会出现引用未注册规则集的静默错误。
 */

import { PROXY_GROUPS } from "../catalog/group-names";
import { ruleSet } from "../catalog/rule-sets";
import { isNotNull } from "../utils/primitives";

export interface BuildRulesInput {
    quicEnabled: boolean;
    hasTailscale: boolean;
}

/**
 * Google Play 在中国大陆的 CDN 节点域名特征。
 *
 * 国行设备通过 `services.googleapis.cn` 获取应用，实际下载走 Ångström 域名
 * `xn--ngstr-lra8j.com`，主机名形如 `rr1---sn-j5o76n7z.xn--ngstr-lra8j.com`。
 * `sn-` 后三位是机场所在地 IATA 码的替换密码，已知大陆节点落在
 * 北京（`2x3`）、上海（`ni5`）、广州（`j5o`），直连可获得最佳下载速度。
 *
 * @see https://blog.l3zc.com/2025/03/chinese-cdn-used-by-playstore/
 */
export const GOOGLE_PLAY_CN_HOST_REGEX =
    "^r+[0-9]+(---|\\.)sn-(2x3|ni5|j5o)\\w{5}\\.xn--ngstr-lra8j\\.com$";

/**
 * 构建最终的规则列表。
 * @param input.quicEnabled - 是否允许 QUIC（未启用时插入 UDP:443 拦截规则）
 * @param input.hasTailscale - 是否存在 Tailscale 节点（决定是否生成 Tailscale 分流规则）
 */
export function buildRules({ quicEnabled, hasTailscale }: BuildRulesInput): string[] {
    return [
        !quicEnabled ? `AND,((DST-PORT,443),(NETWORK,UDP)),REJECT` : null,
        hasTailscale ? `IP-CIDR,100.64.0.0/10,${PROXY_GROUPS.TAILSCALE},no-resolve` : null,
        hasTailscale ? `IP-CIDR,fd7a:115c:a1e0::/48,${PROXY_GROUPS.TAILSCALE},no-resolve` : null,
        hasTailscale ? `DOMAIN-SUFFIX,ts.net,${PROXY_GROUPS.TAILSCALE}` : null,
        `GEOIP,private,DIRECT,no-resolve`,
        ruleSet("ADBlock", PROXY_GROUPS.AD_BLOCK),
        ruleSet("AdditionalFilter", PROXY_GROUPS.AD_BLOCK),
        ruleSet("SogouInput", PROXY_GROUPS.SOGOU_INPUT),
        `DOMAIN-SUFFIX,truthsocial.com,${PROXY_GROUPS.TRUTH_SOCIAL}`,
        ruleSet("StaticResources", PROXY_GROUPS.STATIC_RESOURCES),
        ruleSet("CDNResources", PROXY_GROUPS.STATIC_RESOURCES),
        ruleSet("AdditionalCDNResources", PROXY_GROUPS.STATIC_RESOURCES),
        `GEOSITE,category-cryptocurrency,${PROXY_GROUPS.CRYPTO}`,
        `GEOSITE,category-finance,${PROXY_GROUPS.FINANCE}`,
        `GEOSITE,category-ai-!cn,${PROXY_GROUPS.AI_SERVICE}`,
        ruleSet("ZCode", PROXY_GROUPS.AI_SERVICE),
        `GEOSITE,bilibili,${PROXY_GROUPS.BILIBILI}`,
        `GEOSITE,youtube,${PROXY_GROUPS.YOUTUBE}`,
        `GEOSITE,telegram,${PROXY_GROUPS.TELEGRAM}`,
        `GEOIP,telegram,${PROXY_GROUPS.TELEGRAM},no-resolve`,
        `GEOSITE,xbox,${PROXY_GROUPS.XBOX}`,
        `GEOSITE,github,${PROXY_GROUPS.GITHUB}`,
        `GEOSITE,netflix,${PROXY_GROUPS.NETFLIX}`,
        `GEOSITE,twitch,${PROXY_GROUPS.TWITCH}`,
        `GEOIP,netflix,${PROXY_GROUPS.NETFLIX},no-resolve`,
        `GEOSITE,spotify,${PROXY_GROUPS.SPOTIFY}`,
        `GEOSITE,bahamut,${PROXY_GROUPS.BAHAMUT}`,
        `GEOSITE,pikpak,${PROXY_GROUPS.PIKPAK}`,
        `GEOSITE,twitter,${PROXY_GROUPS.TWITTER}`,
        ruleSet("Weibo", PROXY_GROUPS.WEIBO),
        ruleSet("EHentai", PROXY_GROUPS.EHENTAI),
        ruleSet("TikTok", PROXY_GROUPS.TIKTOK),
        ruleSet("SteamFix", "DIRECT"),
        ruleSet("GoogleFCM", "DIRECT"),
        `DOMAIN-REGEX,${GOOGLE_PLAY_CN_HOST_REGEX},DIRECT`,
        `GEOSITE,google-play@cn,DIRECT`,
        `GEOSITE,microsoft@cn,DIRECT`,
        `GEOSITE,apple,${PROXY_GROUPS.APPLE}`,
        `GEOSITE,microsoft,${PROXY_GROUPS.MICROSOFT}`,
        `GEOSITE,google,${PROXY_GROUPS.GOOGLE}`,
        ruleSet("GFWList", PROXY_GROUPS.SELECT),
        `GEOIP,cn,DIRECT`,
        `MATCH,${PROXY_GROUPS.FINAL}`,
    ].filter(isNotNull);
}
