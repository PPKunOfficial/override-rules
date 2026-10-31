#!/usr/bin/env node
/**
 * 重新抓取游戏服务器网段，输出可直接粘回 `src/catalog/game-networks.ts` 的数组。
 *
 * 用途：`tunexclude` 参数要让 CS2 / Valorant 的流量完全绕开 TUN，靠的是服务器网段列表；
 * 中继与 Riot 网段会随版本变化，更新前跑一次本脚本即可。
 *
 * 用法（在仓库根目录）：
 *   node scripts/game-networks.mjs
 *   # 需要经过代理时（Node 24+ 支持让内置 fetch 使用环境变量里的代理）：
 *   NODE_USE_ENV_PROXY=1 HTTPS_PROXY=http://127.0.0.1:7897 node scripts/game-networks.mjs
 */

import { isIPv4, isIPv6 } from "node:net";

const SDR_URL = "https://api.steampowered.com/ISteamApps/GetSDRConfig/v1/?appid=730";
const RIOT_ASN = "AS6507";
const RIPE_URL = `https://stat.ripe.net/data/announced-prefixes/data.json?resource=${RIOT_ASN}`;

/** 把 IPv4 网段合并成最小 CIDR 覆盖集合。 */
function collapse(networks) {
    const toIp = (int) => [24, 16, 8, 0].map((shift) => (int >>> shift) & 255).join(".");

    // 1. 展开成半开区间并排序
    const ranges = networks
        .map(({ base, prefix }) => ({ start: base, end: base + 2 ** (32 - prefix) }))
        .sort((a, b) => a.start - b.start || a.end - b.end);

    // 2. 合并重叠/相邻区间
    const merged = [];
    for (const range of ranges) {
        const last = merged.at(-1);
        if (last && range.start <= last.end) {
            last.end = Math.max(last.end, range.end);
            continue;
        }
        merged.push({ ...range });
    }

    // 3. 每个区间拆成对齐的最小 CIDR
    const cidrs = [];
    for (let { start, end } of merged) {
        while (start < end) {
            let size = 1;
            while (start % (size * 2) === 0 && start + size * 2 <= end) size *= 2;
            cidrs.push(`${toIp(start)}/${32 - Math.log2(size)}`);
            start += size;
        }
    }

    return cidrs;
}

async function fetchJson(url) {
    const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error(`${url} → HTTP ${response.status}`);
    return response.json();
}

async function collectRiot() {
    const data = await fetchJson(RIPE_URL);
    const networks = [];

    for (const entry of data.data.prefixes) {
        const [ip, prefix] = entry.prefix.split("/");
        if (!isIPv4(ip)) continue;
        networks.push({
            base: ip.split(".").reduce((acc, part) => acc * 256 + Number(part), 0),
            prefix: Number(prefix),
        });
    }

    return collapse(networks);
}

async function collectCs2() {
    const data = await fetchJson(SDR_URL);
    const networks = [];

    for (const pop of Object.values(data.pops ?? {})) {
        for (const relay of pop.relays ?? []) {
            const ip = relay.ipv4;
            if (!ip || !isIPv4(ip)) continue;
            // 按 /24 聚合：中继会在同一网段内轮换，放宽到 /24 后列表不用跟着每次换 IP 改。
            const base = ip.split(".").reduce((acc, part) => acc * 256 + Number(part), 0);
            networks.push({ base: Math.floor(base / 256) * 256, prefix: 24 });
        }
    }

    return collapse(networks);
}

function printList(name, list) {
    console.log(`const ${name} = [`);
    for (const entry of list) console.log(`    "${entry}",`);
    console.log("] as const;");
    console.log();
}

const [riot, cs2] = await Promise.all([collectRiot(), collectCs2()]);
console.log(`// Riot (${RIOT_ASN}) IPv4: ${riot.length} 条；CS2 SDR 中继聚合后: ${cs2.length} 条`);
console.log();
printList("VALORANT_NETWORKS", riot);
printList("CS2_NETWORKS", cs2);

if (riot.some((entry) => isIPv6(entry.split("/")[0]))) {
    console.error("警告：输出里混入了 IPv6 前缀，请手工剔除。");
}
