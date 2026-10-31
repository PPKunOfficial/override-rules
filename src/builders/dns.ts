/**
 * DNS 配置构建，包含 fake-ip 过滤列表与上游 DNS 字段继承。
 */

import type { DnsConfig, DnsPolicyValue } from "../types/clash";

/**
 * 默认的 fake-ip 过滤域名列表：这些域名不会被 fake-ip 机制代理。
 */
const FAKE_IP_FILTER = [
    "geosite:connectivity-check",
    "Mijia Cloud",
    "dig.io.mi.com",
    "localhost.ptlogin2.qq.com",
    "*.icloud.com",
    "*.stun.*.*",
    "*.stun.*.*.*",
    "*.lan",
    "*.localdomain",
    "*.example",
    "*.invalid",
    "*.localhost",
    "*.test",
    "*.local",
    "*.home.arpa",
    "time.*.com",
    "time.*.gov",
    "time.*.edu.cn",
    "time.*.apple.com",
    "time1.*.com",
    "time2.*.com",
    "time3.*.com",
    "time4.*.com",
    "time5.*.com",
    "time6.*.com",
    "time7.*.com",
    "ntp.*.com",
    "ntp1.*.com",
    "ntp2.*.com",
    "ntp3.*.com",
    "ntp4.*.com",
    "ntp5.*.com",
    "ntp6.*.com",
    "ntp7.*.com",
    "*.time.edu.cn",
    "*.ntp.org.cn",
    "+.pool.ntp.org",
    "time1.cloud.tencent.com",
    "stun.*.*",
    "stun.*.*.*",
    "swscan.apple.com",
    "mesu.apple.com",
    "music.163.com",
    "*.music.163.com",
    "*.126.net",
    "musicapi.taihe.com",
    "music.taihe.com",
    "songsearch.kugou.com",
    "trackercdn.kugou.com",
    "*.kuwo.cn",
    "api-jooxtt.sanook.com",
    "api.joox.com",
    "y.qq.com",
    "*.y.qq.com",
    "streamoc.music.tc.qq.com",
    "mobileoc.music.tc.qq.com",
    "isure.stream.qqmusic.qq.com",
    "dl.stream.qqmusic.qq.com",
    "aqqmusic.tc.qq.com",
    "amobile.music.tc.qq.com",
    "localhost.ptlogin2.qq.com",
    "*.msftconnecttest.com",
    "*.msftncsi.com",
    "*.xiami.com",
    "*.music.migu.cn",
    "music.migu.cn",
    "+.wotgame.cn",
    "+.wggames.cn",
    "+.wowsgame.cn",
    "+.wargaming.net",
    "*.*.*.srv.nintendo.net",
    "*.*.stun.playstation.net",
    "xbox.*.*.microsoft.com",
    "*.*.xboxlive.com",
    "*.ipv6.microsoft.com",
    "teredo.*.*.*",
    "teredo.*.*",
    "speedtest.cros.wr.pvp.net",
    "+.jjvip8.com",
    "www.douyu.com",
    "activityapi.huya.com",
    "activityapi.huya.com.w.cdngslb.com",
    "www.bilibili.com",
    "api.bilibili.com",
    "a.w.bilicdn1.com",
    "+.apt-agent.com",
];

/** 支持从上游配置继承的 DNS Policy 字段。 */
const DNS_POLICY_FIELDS = ["nameserver-policy", "proxy-server-nameserver-policy"] as const;

/**
 * 国内域名的主解析上游。
 *
 * 全部走加密 DNS，避免运营商（常见的 `114.114.114.114`、光猫/路由器下发的 DNS）
 * 明文抢答与投毒：阿里 DoH 打头，腾讯 DNSPod 的 DoH/DoT 紧随其后，
 * 火山引擎的明文 UDP 仅作低延迟兜底，断网重连时也能先用上。
 */
const DOMESTIC_DNS_SERVERS = [
    "https://dns.alidns.com/dns-query",
    "https://doh.pub/dns-query",
    "tls://dot.pub",
    "180.184.1.1",
];

/**
 * 引导 DoH/DoT 域名解析的明文服务器。
 *
 * `dns.alidns.com`、`doh.pub` 这些主机名本身需要先被解析，
 * 否则加密上游在冷启动时会互相依赖。这里固定用 IP，不走 `system`，
 * 以免把系统/运营商下发的 DNS 重新拉回解析链路。
 */
const DOMESTIC_BOOTSTRAP_DNS = ["223.5.5.5", "119.29.29.29", "180.184.1.1"];

/** 代理服务端域名专用解析上游：同样只用加密 DNS，且不经过代理自身。 */
const PROXY_SERVER_DNS = ["https://dns.alidns.com/dns-query", "https://doh.pub/dns-query"];

/**
 * 海外域名的解析上游。
 *
 * 这些解析器在大陆直连基本不可达（明文与 DoH 都会被干扰），因此每条都带 `#RULES` 后缀：
 * 该服务器自身的连接按 `rules` 匹配，命中代理组时经代理访问，从而拿到未经污染的海外结果。
 * 由于要经 TCP 代理转发，这里只用 DoH/DoT，不用 DoQ（QUIC 走 UDP，无法被 HTTP/SOCKS 代理承载）；
 * 并且优先使用 IP 直连端点，避免主机名被国内引导解析劫持到 `127.0.0.1`（实测 `dns.sb` 曾被这样投毒）。
 */
const FOREIGN_DNS_SERVERS = [
    "https://1.1.1.1/dns-query#RULES",
    "https://8.8.8.8/dns-query#RULES",
    "tls://dns.quad9.net#RULES",
    "https://dns.google/dns-query#RULES",
    "https://cloudflare-dns.com/dns-query#RULES",
];

/** 判断 DNS 上游返回的地址是否已被污染，需要走海外兜底。 */
const FALLBACK_FILTER = {
    geoip: true,
    "geoip-code": "CN",
    ipcidr: ["240.0.0.0/4", "0.0.0.0/32"],
};

/** 判断值是否为非数组对象。 */
function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 读取仅包含字符串的数组，过滤格式错误的上游字段。 */
function getStringList(value: unknown): string[] | undefined {
    return Array.isArray(value) && value.every((item) => typeof item === "string")
        ? value
        : undefined;
}

/** 合并两个字符串列表并移除重复值，保留当前配置的优先顺序。 */
function mergeStringLists(current: string[] | undefined, upstream: unknown): string[] | undefined {
    const upstreamList = getStringList(upstream);
    if (!current && !upstreamList) return undefined;

    return [...new Set([...(current ?? []), ...(upstreamList ?? [])])];
}

/** 合并 DNS Policy，仅保留 Clash 支持的字符串或字符串数组值。 */
function mergeDnsPolicies(
    current: Record<string, DnsPolicyValue> | undefined,
    upstream: unknown
): Record<string, DnsPolicyValue> | undefined {
    if (!isRecord(upstream)) return current;

    const upstreamPolicy: Record<string, DnsPolicyValue> = {};
    for (const [key, value] of Object.entries(upstream)) {
        if (typeof value === "string") {
            upstreamPolicy[key] = value;
        } else if (getStringList(value)) {
            upstreamPolicy[key] = value as string[];
        }
    }

    return { ...(current ?? {}), ...upstreamPolicy };
}

/** 仅合并允许继承的上游 DNS 字段，同时保留脚本控制字段的优先级。 */
function inheritDnsFields(generated: DnsConfig, upstream?: DnsConfig): DnsConfig {
    if (!isRecord(upstream)) return generated;

    const merged = { ...generated };

    for (const field of DNS_POLICY_FIELDS) {
        const policy = mergeDnsPolicies(merged[field], upstream[field]);
        if (policy) merged[field] = policy;
    }

    const fakeIpFilter = mergeStringLists(merged["fake-ip-filter"], upstream["fake-ip-filter"]);
    if (fakeIpFilter) merged["fake-ip-filter"] = fakeIpFilter;

    return merged;
}

interface BuildDnsConfigInput {
    mode: "redir-host" | "fake-ip";
    ipv6Enabled: boolean;
    fakeIpFilter?: string[];
}

/** 生成脚本控制的核心 DNS 设置。 */
function buildDnsConfig({ mode, ipv6Enabled, fakeIpFilter }: BuildDnsConfigInput): DnsConfig {
    const config: DnsConfig = {
        enable: true,
        ipv6: ipv6Enabled,
        // 海外上游经代理转发，QUIC/h3 无法被 HTTP/SOCKS 代理承载，统一走 TCP 上的 HTTP2
        "prefer-h3": false,
        "cache-algorithm": "arc",
        "enhanced-mode": mode,
        "default-nameserver": DOMESTIC_BOOTSTRAP_DNS,
        nameserver: DOMESTIC_DNS_SERVERS,
        "proxy-server-nameserver": PROXY_SERVER_DNS,
        "nameserver-policy": {
            "geosite:cn": [...DOMESTIC_DNS_SERVERS],
            "geosite:geolocation-!cn": [...FOREIGN_DNS_SERVERS],
        },
        fallback: FOREIGN_DNS_SERVERS,
        "fallback-filter": FALLBACK_FILTER,
    };

    if (fakeIpFilter) {
        config["fake-ip-filter"] = fakeIpFilter;
    }

    return config;
}

/** 构建 DNS 配置的输入参数。 */
export interface BuildDnsInput {
    fakeIPEnabled: boolean;
    ipv6Enabled: boolean;
    /** 上游订阅提供的 DNS 配置，将按字段规则继承或融合。 */
    upstreamDns?: DnsConfig;
}

/**
 * 根据 fakeIP 与 IPv6 开关生成最终 DNS 配置，并合并上游允许继承的字段。
 * @param input - 详见 `BuildDnsInput`
 */
export function buildDns({ fakeIPEnabled, ipv6Enabled, upstreamDns }: BuildDnsInput): DnsConfig {
    const generated = fakeIPEnabled
        ? buildDnsConfig({ mode: "fake-ip", ipv6Enabled, fakeIpFilter: FAKE_IP_FILTER })
        : buildDnsConfig({ mode: "redir-host", ipv6Enabled });

    return inheritDnsFields(generated, upstreamDns);
}
