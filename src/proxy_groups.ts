import {
    CDN_URL,
    SPEEDTEST_URL,
    LOW_COST_NODE_MATCHER,
    NODE_SUFFIX,
    PROXY_GROUPS,
    countriesMeta,
} from "./constants";
import type { BuildProxyGroupsInput, GroupType, ProxyGroup } from "./types";
import { isNotNull } from "./utils";

interface BuildGroupByTypeInput {
    name: string;
    icon: string;
    groupType: GroupType;
    nodeSource: Pick<ProxyGroup, "proxies" | "include-all" | "filter" | "exclude-filter">;
}

/**
 * 根据代理组类型生成对应的代理组配置。
 * 将 groupType 映射为具体的类型字段（select/url-test/load-balance），
 * 并与节点来源字段合并，消除各处重复的 switch 逻辑。
 */
function buildGroupByType({
    name,
    icon,
    groupType,
    nodeSource,
}: BuildGroupByTypeInput): ProxyGroup {
    switch (groupType) {
        case 0:
            return { name, icon, type: "select", ...nodeSource };
        case 1:
            return {
                name,
                icon,
                type: "url-test",
                url: SPEEDTEST_URL,
                interval: 60,
                tolerance: 20,
                ...nodeSource,
            };
        case 2:
            return {
                name,
                icon,
                type: "load-balance",
                strategy: "sticky-sessions",
                url: SPEEDTEST_URL,
                interval: 60,
                tolerance: 20,
                ...nodeSource,
            };
    }
}

/**
 * 生成所有代理组配置，包含内联的国家地区代理组。
 * @param input - 构建代理组所需的输入参数（详见 BuildProxyGroupsInput）
 * @returns 代理组配置数组
 */
export function buildProxyGroups({
    regexFilter,
    groupType,
    countryNames,
    countryNodes,
    lowCostNodes,
    landing,
    landingNodes,
    defaultProxies,
    defaultProxiesDirect,
    defaultSelector,
    defaultFallback,
    frontProxySelector,
}: BuildProxyGroupsInput): ProxyGroup[] {
    const hasTW = countryNames.includes("台湾");
    const hasHK = countryNames.includes("香港");
    const groups: Array<ProxyGroup | null> = [
        {
            name: PROXY_GROUPS.SELECT,
            icon: `${CDN_URL}/gh/Koolson/Qure@master/IconSet/Color/Proxy.png`,
            type: "select",
            "include-all": true,
            proxies: defaultSelector,
        },
        landing
            ? {
                  name: PROXY_GROUPS.FRONT_PROXY,
                  icon: `${CDN_URL}/gh/Koolson/Qure@master/IconSet/Color/Area.png`,
                  type: "select",
                  proxies: frontProxySelector,
              }
            : null,
        landing
            ? {
                  name: PROXY_GROUPS.LANDING,
                  icon: `${CDN_URL}/gh/Koolson/Qure@master/IconSet/Color/Airport.png`,
                  type: "select",
                  proxies: landingNodes.map((node) => node.name).filter(isNotNull),
              }
            : null,
        {
            name: PROXY_GROUPS.STATIC_RESOURCES,
            icon: `${CDN_URL}/gh/Koolson/Qure@master/IconSet/Color/Cloudflare.png`,
            type: "select",
            "include-all": true,
            proxies: defaultProxies,
        },
        {
            name: PROXY_GROUPS.AI_SERVICE,
            icon: `${CDN_URL}/gh/Koolson/Qure@master/IconSet/Color/ChatGPT.png`,
            type: "select",
            "include-all": true,
            proxies: defaultProxies,
        },
        {
            name: PROXY_GROUPS.APPLE,
            icon: `${CDN_URL}/gh/Koolson/Qure@master/IconSet/Color/Apple_2.png`,
            type: "select",
            "include-all": true,
            proxies: defaultProxies,
        },
        {
            name: PROXY_GROUPS.GOOGLE,
            icon: `${CDN_URL}/gh/Orz-3/mini@master/Color/Google.png`,
            type: "select",
            "include-all": true,
            proxies: [PROXY_GROUPS.AI_SERVICE, ...defaultProxies],
        },
        {
            name: PROXY_GROUPS.MICROSOFT,
            icon: `${CDN_URL}/gh/PPKunOfficial/override-rules@main/icons/Microsoft_Copilot.png`,
            type: "select",
            "include-all": true,
            proxies: defaultProxies,
        },
        {
            name: PROXY_GROUPS.GITHUB,
            icon: `${CDN_URL}/gh/Koolson/Qure@master/IconSet/Color/GitHub.png`,
            type: "select",
            "include-all": true,
            proxies: defaultProxies,
        },
        {
            name: PROXY_GROUPS.ASIA_STREAMING,
            icon: `${CDN_URL}/gh/Koolson/Qure@master/IconSet/Color/DomesticMedia.png`,
            type: "select",
            "include-all": true,
            proxies:
                hasTW && hasHK
                    ? ["DIRECT", PROXY_GROUPS.SELECT, `台湾节点`, `香港节点`]
                    : defaultProxiesDirect,
        },
        {
            name: PROXY_GROUPS.BILIBILI,
            icon: `${CDN_URL}/gh/Orz-3/mini@master/Color/bilibili.png`,
            type: "select",
            "include-all": true,
            proxies: defaultProxiesDirect,
        },
        {
            name: PROXY_GROUPS.WESTERN_STREAMING,
            icon: `${CDN_URL}/gh/Koolson/Qure@master/IconSet/Color/ForeignMedia.png`,
            type: "select",
            "include-all": true,
            proxies: defaultProxies,
        },
        {
            name: PROXY_GROUPS.PC_GAMES,
            icon: `${CDN_URL}/gh/Koolson/Qure@master/IconSet/Color/Game.png`,
            type: "select",
            "include-all": true,
            proxies: defaultProxies,
        },
        {
            name: PROXY_GROUPS.SOCIAL_MEDIA,
            icon: `${CDN_URL}/gh/PPKunOfficial/override-rules@main/icons/Telegram.png`,
            type: "select",
            "include-all": true,
            proxies: defaultProxies,
        },
        {
            name: PROXY_GROUPS.R18,
            icon: `${CDN_URL}/gh/Koolson/Qure@master/IconSet/Color/Bookpedia.png`,
            type: "select",
            "include-all": true,
            proxies: defaultProxies,
        },
        {
            name: PROXY_GROUPS.PIKPAK,
            icon: `${CDN_URL}/gh/PPKunOfficial/override-rules@main/icons/PikPak.png`,
            type: "select",
            "include-all": true,
            proxies: defaultProxies,
        },
        {
            name: PROXY_GROUPS.DOMESTIC_SERVICE,
            icon: `${CDN_URL}/gh/Koolson/Qure@master/IconSet/Color/Domestic.png`,
            type: "select",
            "include-all": true,
            proxies: ["DIRECT", "REJECT"],
        },
        {
            name: PROXY_GROUPS.SOGOU_INPUT,
            icon: `${CDN_URL}/gh/PPKunOfficial/override-rules@main/icons/Sougou.png`,
            type: "select",
            proxies: ["DIRECT", "REJECT"],
        },
        {
            name: PROXY_GROUPS.SSH,
            icon: `${CDN_URL}/gh/Koolson/Qure@master/IconSet/Color/Server.png`,
            type: "select",
            "include-all": true,
            proxies: defaultProxies,
        },
        {
            name: PROXY_GROUPS.AD_BLOCK,
            icon: `${CDN_URL}/gh/Koolson/Qure@master/IconSet/Color/AdBlack.png`,
            type: "select",
            proxies: ["REJECT", "REJECT-DROP", "DIRECT"],
        },
        {
            name: PROXY_GROUPS.FINAL,
            icon: `${CDN_URL}/gh/Koolson/Qure@master/IconSet/Color/Final.png`,
            type: "select",
            "include-all": true,
            proxies: [PROXY_GROUPS.SELECT, "DIRECT"],
        },
        {
            name: PROXY_GROUPS.AUTO,
            icon: `${CDN_URL}/gh/Koolson/Qure@master/IconSet/Color/Auto.png`,
            type: "url-test",
            url: SPEEDTEST_URL,
            proxies: defaultFallback,
            interval: 60,
            tolerance: 20,
        },
        {
            name: PROXY_GROUPS.FALLBACK,
            icon: `${CDN_URL}/gh/Koolson/Qure@master/IconSet/Color/Available_1.png`,
            type: "fallback",
            url: SPEEDTEST_URL,
            proxies: defaultFallback,
            interval: 60,
            tolerance: 20,
        },
        lowCostNodes.length > 0 || regexFilter
            ? buildGroupByType({
                  name: PROXY_GROUPS.LOW_COST,
                  icon: `${CDN_URL}/gh/Koolson/Qure@master/IconSet/Color/Lab.png`,
                  groupType,
                  nodeSource: !regexFilter
                      ? { proxies: lowCostNodes.map((node) => node.name).filter(isNotNull) }
                      : { "include-all": true as const, filter: LOW_COST_NODE_MATCHER.pattern },
              })
            : null,
        ...countryNames.map((country) => {
            const meta = countriesMeta[country];
            if (!meta) return null;
            const nodeSource = regexFilter
                ? {
                      "include-all": true as const,
                      filter: meta.pattern,
                      ...(meta.excludePattern ? { "exclude-filter": meta.excludePattern } : {}),
                  }
                : { proxies: countryNodes[country]?.map((n) => n.name).filter(isNotNull) };
            return buildGroupByType({
                name: `${country}${NODE_SUFFIX}`,
                icon: meta.icon,
                groupType,
                nodeSource,
            });
        }),
    ];

    return groups.filter(isNotNull);
}
