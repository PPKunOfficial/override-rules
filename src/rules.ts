import { PROXY_GROUPS } from "./constants";

const baseRules = [
    `DST-PORT,22,${PROXY_GROUPS.SSH}`,
    `GEOIP,private,DIRECT,no-resolve`,
    `RULE-SET,ADBlock,${PROXY_GROUPS.AD_BLOCK}`,
    `RULE-SET,AdditionalFilter,${PROXY_GROUPS.AD_BLOCK}`,
    `RULE-SET,SogouInput,${PROXY_GROUPS.SOGOU_INPUT}`,
    `RULE-SET,StaticResources,${PROXY_GROUPS.STATIC_RESOURCES}`,
    `RULE-SET,CDNResources,${PROXY_GROUPS.STATIC_RESOURCES}`,
    `RULE-SET,AdditionalCDNResources,${PROXY_GROUPS.STATIC_RESOURCES}`,
    `GEOSITE,category-ai-!cn,${PROXY_GROUPS.AI_SERVICE}`,
    `GEOSITE,bilibili,${PROXY_GROUPS.BILIBILI}`,
    `GEOSITE,bahamut,${PROXY_GROUPS.ASIA_STREAMING}`,
    `GEOSITE,abema,${PROXY_GROUPS.ASIA_STREAMING}`,
    `GEOSITE,niconico,${PROXY_GROUPS.ASIA_STREAMING}`,
    `GEOSITE,dmm,${PROXY_GROUPS.ASIA_STREAMING}`,
    `GEOSITE,disney,${PROXY_GROUPS.ASIA_STREAMING}`,
    `GEOSITE,primevideo,${PROXY_GROUPS.ASIA_STREAMING}`,
    `GEOSITE,kakao,${PROXY_GROUPS.ASIA_STREAMING}`,
    `GEOSITE,viu,${PROXY_GROUPS.ASIA_STREAMING}`,
    `GEOSITE,hotstar,${PROXY_GROUPS.ASIA_STREAMING}`,
    `GEOSITE,tvb,${PROXY_GROUPS.ASIA_STREAMING}`,
    `GEOSITE,mytvsuper,${PROXY_GROUPS.ASIA_STREAMING}`,
    `RULE-SET,TikTok,${PROXY_GROUPS.ASIA_STREAMING}`,
    `GEOSITE,youtube,${PROXY_GROUPS.WESTERN_STREAMING}`,
    `GEOSITE,twitch,${PROXY_GROUPS.WESTERN_STREAMING}`,
    `GEOSITE,netflix,${PROXY_GROUPS.WESTERN_STREAMING}`,
    `GEOIP,netflix,${PROXY_GROUPS.WESTERN_STREAMING},no-resolve`,
    `GEOSITE,spotify,${PROXY_GROUPS.WESTERN_STREAMING}`,
    `GEOSITE,telegram,${PROXY_GROUPS.SOCIAL_MEDIA}`,
    `GEOIP,telegram,${PROXY_GROUPS.SOCIAL_MEDIA},no-resolve`,
    `GEOSITE,github,${PROXY_GROUPS.GITHUB}`,
    `GEOSITE,category-games-!cn,${PROXY_GROUPS.PC_GAMES}`,
    `GEOSITE,category-game-platforms-download,${PROXY_GROUPS.PC_GAMES}`,
    `GEOSITE,category-game-platforms-download@cn,DIRECT`,
    `GEOSITE,category-games-cn,DIRECT`,
    `GEOSITE,pikpak,${PROXY_GROUPS.PIKPAK}`,
    `GEOSITE,twitter,${PROXY_GROUPS.SOCIAL_MEDIA}`,
    `RULE-SET,Weibo,${PROXY_GROUPS.DOMESTIC_SERVICE}`,
    `DOMAIN-SUFFIX,truthsocial.com,${PROXY_GROUPS.SOCIAL_MEDIA}`,
    `GEOSITE,category-porn,${PROXY_GROUPS.R18}`,
    `RULE-SET,EHentai,${PROXY_GROUPS.R18}`,
    `RULE-SET,SteamFix,DIRECT`,
    `RULE-SET,GoogleFCM,DIRECT`,
    `GEOSITE,google-play@cn,DIRECT`,
    `GEOSITE,microsoft@cn,DIRECT`,
    `GEOSITE,apple,${PROXY_GROUPS.APPLE}`,
    `GEOSITE,microsoft,${PROXY_GROUPS.MICROSOFT}`,
    `GEOSITE,google,${PROXY_GROUPS.GOOGLE}`,
    `RULE-SET,GFWList,${PROXY_GROUPS.SELECT}`,
    `GEOIP,cn,${PROXY_GROUPS.DOMESTIC_SERVICE}`,
    `MATCH,${PROXY_GROUPS.FINAL}`,
];

/**
 * 构建最终的规则列表。
 *
 * @param {Object} params - 构建参数
 * @param {boolean} params.quicEnabled - 是否启用 QUIC（如未启用会插入 UDP:443 拦截规则）
 * @returns {string[]} 规则字符串数组
 */
export function buildRules({ quicEnabled }: { quicEnabled: boolean }): string[] {
    const ruleList = [...baseRules];
    if (!quicEnabled) {
        ruleList.unshift("AND,((DST-PORT,443),(NETWORK,UDP)),REJECT");
    }
    return ruleList;
}
