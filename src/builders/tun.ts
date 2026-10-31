/**
 * TUN 模式配置构建。
 */

import type { TunConfig } from "../types/clash";

/**
 * 构建 Clash 内核的 TUN 模式配置。
 *
 * 使用 gvisor 网络栈，并排除 Tailscale 与局域网地址段以避免路由冲突。
 * @param tunEnabled - 是否启用 TUN 模式
 * @param hasTailscale - 是否存在 Tailscale 节点
 * @param excludeAddresses - 额外排除的网段（`tunexclude` 参数解析结果）
 * @returns TUN 配置对象。`100.64.0.0/10` 与 `fd7a:115c:a1e0::/48` 为 Tailscale
 *   CGNAT/IPv6 地址段（仅在无 Tailscale 节点时排除），`192.168.0.0/16` 为局域网地址段。
 */
export function buildTunConfig(
    tunEnabled: boolean,
    hasTailscale: boolean,
    excludeAddresses: string[] = []
): TunConfig {
    return {
        enable: tunEnabled,
        stack: "mips",
        device: "mihomo",
        "route-exclude-address": [
            ...new Set([
                ...(!hasTailscale ? ["100.64.0.0/10", "fd7a:115c:a1e0::/48"] : []),
                "192.168.0.0/16",
                ...excludeAddresses,
            ]),
        ],
        "dns-hijack": ["any:53"],
        mtu: 1500,
    };
}
