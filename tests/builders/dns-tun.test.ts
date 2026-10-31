import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildDns } from "../../src/builders/dns";
import { buildTunConfig } from "../../src/builders/tun";

describe("buildDns", () => {
    it("fake-ip 模式包含 fake-ip-filter", () => {
        const dns = buildDns({ fakeIPEnabled: true, ipv6Enabled: false });
        assert.equal(dns["enhanced-mode"], "fake-ip");
        assert.ok(Array.isArray(dns["fake-ip-filter"]));
        assert.ok((dns["fake-ip-filter"] ?? []).length > 0);
    });

    it("redir-host 模式不含 fake-ip-filter", () => {
        const dns = buildDns({ fakeIPEnabled: false, ipv6Enabled: false });
        assert.equal(dns["enhanced-mode"], "redir-host");
        assert.equal(dns["fake-ip-filter"], undefined);
    });

    it("继承上游 nameserver-policy 与 fake-ip-filter", () => {
        const dns = buildDns({
            fakeIPEnabled: true,
            ipv6Enabled: false,
            upstreamDns: {
                enable: true,
                ipv6: false,
                "prefer-h3": true,
                "enhanced-mode": "fake-ip",
                nameserver: [],
                fallback: [],
                "nameserver-policy": { "geosite:cn": ["223.5.5.5"] },
                "fake-ip-filter": ["+.example.org"],
            },
        });
        // 同名 key 由上游覆盖，脚本自带的分区策略继续保留
        assert.deepEqual(dns["nameserver-policy"]?.["geosite:cn"], ["223.5.5.5"]);
        assert.equal(
            dns["nameserver-policy"]?.["geosite:private"],
            undefined,
            "私网域名不额外分区，交给默认上游"
        );
        assert.ok(dns["fake-ip-filter"]?.includes("+.example.org"));
    });

    it("国内解析不使用系统解析器与 114 DNS", () => {
        const dns = buildDns({ fakeIPEnabled: true, ipv6Enabled: false });
        const domestic = [...dns.nameserver, ...(dns["default-nameserver"] ?? [])];

        assert.ok(!domestic.includes("system"), "不应依赖系统/运营商下发的解析器");
        assert.ok(
            domestic.every((server) => !server.includes("114.")),
            "国内上游不应使用 114 DNS"
        );
    });

    it("国内上游加密优先，明文只作兜底", () => {
        const dns = buildDns({ fakeIPEnabled: false, ipv6Enabled: false });

        assert.ok(dns.nameserver[0].startsWith("https://"), "首选上游应为 DoH");
        assert.ok(
            dns.nameserver.some((server) => server.startsWith("tls://")),
            "缺少 DoT 上游"
        );
        assert.ok(
            dns.nameserver.slice(0, -1).every((server) => /^(https|tls):\/\//.test(server)),
            "除最后一项兜底外，国内上游应全部加密"
        );
        assert.deepEqual(dns["default-nameserver"], ["223.5.5.5", "119.29.29.29", "180.184.1.1"]);
    });

    it("代理服务端域名走独立加密解析", () => {
        const dns = buildDns({ fakeIPEnabled: true, ipv6Enabled: false });
        const proxyDns = dns["proxy-server-nameserver"] ?? [];

        assert.ok(proxyDns.length > 0);
        assert.ok(proxyDns.every((server) => server.startsWith("https://")));
    });

    it("国内域名分区解析，海外域名仅在污染时兜底", () => {
        const dns = buildDns({ fakeIPEnabled: true, ipv6Enabled: false });
        const policy = dns["nameserver-policy"] ?? {};

        assert.deepEqual(policy["geosite:cn"], dns.nameserver);
        assert.deepEqual(Object.keys(policy), ["geosite:cn"]);
        assert.deepEqual(dns["fallback-filter"], {
            geoip: true,
            "geoip-code": "CN",
            ipcidr: ["240.0.0.0/4", "0.0.0.0/32"],
        });
        assert.ok(dns.fallback.every((server) => !server.includes("114.")));
    });

    it("脚本控制字段优先级高于上游", () => {
        const dns = buildDns({
            fakeIPEnabled: false,
            ipv6Enabled: true,
            upstreamDns: {
                enable: true,
                ipv6: false,
                "prefer-h3": true,
                "enhanced-mode": "fake-ip",
                nameserver: [],
                fallback: [],
            },
        });
        assert.equal(dns["enhanced-mode"], "redir-host");
        assert.equal(dns.ipv6, true);
    });
});

describe("buildTunConfig", () => {
    it("无 Tailscale 时排除 Tailscale 地址段", () => {
        const tun = buildTunConfig(true, false);
        assert.deepEqual(tun["route-exclude-address"], [
            "100.64.0.0/10",
            "fd7a:115c:a1e0::/48",
            "192.168.0.0/16",
        ]);
    });

    it("有 Tailscale 时不排除 Tailscale 地址段", () => {
        const tun = buildTunConfig(true, true);
        assert.deepEqual(tun["route-exclude-address"], ["192.168.0.0/16"]);
    });

    it("保留设备名与 MTU", () => {
        const tun = buildTunConfig(false, false);
        assert.equal(tun.device, "mihomo");
        assert.equal(tun.mtu, 1500);
        assert.equal(tun.enable, false);
    });
});
