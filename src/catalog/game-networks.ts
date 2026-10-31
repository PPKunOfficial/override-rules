/**
 * 游戏服务器网段的 TUN 排除预设。
 *
 * 有些游戏不适合经过任何代理：CS2 走 Steam Datagram Relay 中继，Valorant 走
 * Riot 自有网段，绕一圈节点只会抬高延迟。把它们的服务器网段从 TUN 路由里排除，
 * 这些流量就完全不进内核（真正的「绕过 Clash」，而不只是走 DIRECT）。
 *
 * 数据来源与刷新方式：
 * - `valorant`：Riot Games AS6507 的全部 IPv4 前缀（RIPE stat announced-prefixes），聚合后 15 条。
 * - `cs2`：Steam 官方 SDR 配置 `ISteamApps/GetSDRConfig/v1/?appid=730` 的全部中继 IPv4，
 *   按 /24 聚合成 34 条（原配置 218 个中继地址，revision 1793064244）。
 *
 * 重新抓取：`node scripts/game-networks.mjs`，把输出贴回本文件。
 * 中继与 Riot 网段都会随版本变化，建议每次版本更新后跑一次。
 */

const VALORANT_NETWORKS = [
    "43.229.64.0/22",
    "45.7.36.0/22",
    "45.250.208.0/22",
    "103.219.128.0/22",
    "103.240.224.0/22",
    "104.160.128.0/19",
    "138.0.12.0/22",
    "151.106.246.0/23",
    "151.106.248.0/22",
    "151.106.252.0/23",
    "151.106.254.0/24",
    "162.249.72.0/21",
    "185.40.64.0/22",
    "192.64.168.0/21",
    "192.207.0.0/24",
] as const;

const CS2_NETWORKS = [
    "39.156.182.0/24",
    "45.121.184.0/24",
    "58.254.163.0/24",
    "61.152.104.0/24",
    "89.222.108.0/24",
    "89.222.117.0/24",
    "101.206.160.0/24",
    "103.10.124.0/23",
    "103.28.54.0/24",
    "111.206.90.0/24",
    "112.45.45.0/24",
    "114.113.213.0/24",
    "117.185.19.0/24",
    "118.123.224.0/24",
    "120.233.106.0/24",
    "140.206.227.0/24",
    "146.66.152.0/24",
    "146.66.155.0/24",
    "152.233.52.0/24",
    "155.133.224.0/22",
    "155.133.230.0/24",
    "155.133.238.0/24",
    "155.133.244.0/24",
    "155.133.246.0/24",
    "155.133.248.0/23",
    "155.133.252.0/24",
    "155.133.255.0/24",
    "162.254.192.0/21",
    "180.163.126.0/24",
    "183.60.122.0/24",
    "185.25.180.0/24",
    "185.25.182.0/23",
    "205.196.6.0/24",
    "212.102.63.0/24",
] as const;

/** 可用的游戏网段预设名。 */
export const GAME_NETWORK_PRESETS = {
    valorant: VALORANT_NETWORKS,
    cs2: CS2_NETWORKS,
} as const;

export type GameNetworkPresetKey = keyof typeof GAME_NETWORK_PRESETS;

/** IPv4 CIDR：四段 0-255 + 前缀 0-32。 */
const IPV4_CIDR_PATTERN = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\/(\d{1,2})$/;

/** 宽松的 IPv6 CIDR：包含冒号即可，前缀单独校验。 */
const IPV6_CIDR_PATTERN = /^([0-9A-Fa-f:]+)\/(\d{1,3})$/;

/**
 * 校验并规范化单条 CIDR。
 *
 * 允许省略前缀的纯 IPv4（补成 `/32`）。非法输入返回 `null`，由调用方丢弃——
 * 一条写错的网段不该让整个 TUN 配置解析失败。
 * @param raw - 原始条目，例如 `162.249.72.0/21` 或 `1.2.3.4`
 */
export function normalizeCidr(raw: string): string | null {
    const value = raw.trim();
    if (value.length === 0) return null;

    const ipv4 = IPV4_CIDR_PATTERN.exec(value);
    if (ipv4) {
        const octets = ipv4.slice(1, 5).map(Number);
        const prefix = Number(ipv4[5]);
        if (octets.some((octet) => octet > 255) || prefix > 32) return null;
        return value;
    }

    const ipv6 = IPV6_CIDR_PATTERN.exec(value);
    if (ipv6) {
        if (Number(ipv6[2]) > 128 || ipv6[1].split(":").length > 8) return null;
        return value;
    }

    const bareIpv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(value);
    if (bareIpv4) {
        const octets = bareIpv4.slice(1, 5).map(Number);
        if (octets.some((octet) => octet > 255)) return null;
        return `${value}/32`;
    }

    return null;
}

function isPresetKey(token: string): token is GameNetworkPresetKey {
    return token in GAME_NETWORK_PRESETS;
}

/**
 * 解析 `tunexclude` 参数：支持预设名与自定义 CIDR 混写。
 *
 * 例：`tunexclude=cs2,valorant`、`tunexclude=1.2.3.0/24|cs2`。
 * 未知预设名与非法 CIDR 一律丢弃，结果按首次出现去重。
 * @param raw - 原始参数值
 */
export function parseTunExclude(raw?: string): string[] {
    if (!raw) return [];

    const result: string[] = [];
    const seen = new Set<string>();

    const push = (cidr: string) => {
        if (seen.has(cidr)) return;
        seen.add(cidr);
        result.push(cidr);
    };

    for (const part of raw.split(/[,|;\n]+/)) {
        const token = part.trim();
        if (token.length === 0) continue;

        if (isPresetKey(token.toLowerCase())) {
            for (const cidr of GAME_NETWORK_PRESETS[token.toLowerCase() as GameNetworkPresetKey]) {
                push(cidr);
            }
            continue;
        }

        const cidr = normalizeCidr(token);
        if (cidr) push(cidr);
    }

    return result;
}
