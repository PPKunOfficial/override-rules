/**
 * 脚本参数与功能开关相关的类型定义。
 */

/** Substore/Clash 覆写脚本从 URL hash 接收的原始字符串参数。 */
export interface ScriptArgs {
    grouptype?: string;
    loadbalance?: string;
    ipv6?: string;
    full?: string;
    keepalive?: string;
    fakeip?: string;
    quic?: string;
    regex?: string;
    threshold?: string;
    tun?: string;
    procdirect?: string;
    procproxy?: string;
    tunexclude?: string;
    pcgame?: string;
}

/** 地区代理组类型：0=select（手动选择），1=url-test（自动测速），2=load-balance（负载均衡）。 */
export type GroupType = 0 | 1 | 2;

/** 解析后的功能开关集合，下游模块无需再关心参数来源或缺失情况。 */
export interface FeatureFlags {
    groupType: GroupType;
    ipv6Enabled: boolean;
    fullConfig: boolean;
    keepAliveEnabled: boolean;
    fakeIPEnabled: boolean;
    quicEnabled: boolean;
    regexFilter: boolean;
    countryThreshold: number;
    tunEnabled: boolean;
    /** 这些进程的流量一律直连（不经过任何节点）。 */
    directProcesses: string[];
    /** 这些进程的流量一律走「选择代理」，用于反被规则判成直连的程序。 */
    proxyProcesses: string[];
    /** 从 TUN 路由中排除的网段（游戏服务器等需要完全绕开内核的流量）。 */
    tunExcludeAddresses: string[];
    /** 是否把内置 PC 游戏进程清单接入「PC 游戏」组。 */
    pcGameEnabled: boolean;
}
