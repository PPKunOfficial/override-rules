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

    it("国内上游全部加密且不使用主机名端点", () => {
        const dns = buildDns({ fakeIPEnabled: false, ipv6Enabled: false });

        assert.ok(dns.nameserver[0].startsWith("https://"), "首选上游应为 DoH");
        assert.ok(
            dns.nameserver.some((server) => server.startsWith("tls://")),
            "缺少 DoT 上游"
        );
        assert.ok(
            dns.nameserver.every((server) => /^(https|tls):\/\//.test(server)),
            "国内上游不应出现明文 DNS"
        );
        for (const server of dns.nameserver) {
            assert.match(
                server,
                /^(https|tls):\/\/[0-9.]+/,
                `${server} 应为主机名端点以外的 IP 端点`
            );
        }
        assert.deepEqual(dns["default-nameserver"], ["223.5.5.5", "119.29.29.29", "180.184.1.1"]);
    });

    it("代理服务端域名走独立加密解析", () => {
        const dns = buildDns({ fakeIPEnabled: true, ipv6Enabled: false });
        const proxyDns = dns["proxy-server-nameserver"] ?? [];

        assert.ok(proxyDns.length > 0);
        assert.ok(proxyDns.every((server) => server.startsWith("https://")));
        assert.ok(proxyDns.every((server) => /^https:\/\/[0-9.]+/.test(server)));
    });

    it("国内域名走加密上游，海外域名走海外上游", () => {
        const dns = buildDns({ fakeIPEnabled: true, ipv6Enabled: false });
        const policy = dns["nameserver-policy"] ?? {};

        assert.deepEqual(policy["geosite:cn"], dns.nameserver);
        assert.deepEqual(policy["geosite:geolocation-!cn"], dns.fallback);
        assert.deepEqual(Object.keys(policy), ["geosite:cn", "geosite:geolocation-!cn"]);
        assert.deepEqual(dns["fallback-filter"], {
            geoip: true,
            "geoip-code": "CN",
            ipcidr: ["240.0.0.0/4", "0.0.0.0/32"],
        });
        assert.ok(dns.fallback.every((server) => !server.includes("114.")));
    });

    it("海外上游加密且遵循规则走代理", () => {
        const dns = buildDns({ fakeIPEnabled: true, ipv6Enabled: false });

        for (const server of dns.fallback) {
            assert.ok(server.endsWith("#RULES"), `${server} 缺少 #RULES，会在直连时被污染`);
            assert.match(server, /^(https|tls):\/\//, `${server} 应为加密上游`);
        }

        assert.ok(
            dns.fallback.every((server) => !server.startsWith("quic://")),
            "DoQ 走 UDP，无法被代理承载"
        );
        assert.ok(
            dns.fallback.every((server) => /^(https|tls):\/\/[0-9.]+/.test(server)),
            "海外上游应全部为主机名端点以外的 IP 端点，避免引导解析投毒"
        );
        assert.deepEqual(
            dns.fallback.map((server) => server.split(":")[0]),
            ["https", "https", "https", "https", "tls"],
            "DoH 应排在 DoT 之前"
        );
        assert.equal(dns["prefer-h3"], false);
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

    it("把 tunexclude 网段追加到排除列表且去重", () => {
        const tun = buildTunConfig(true, true, ["162.249.72.0/21", "192.168.0.0/16"]);
        assert.deepEqual(tun["route-exclude-address"], ["192.168.0.0/16", "162.249.72.0/21"]);
    });

    it("保留设备名与 MTU", () => {
        const tun = buildTunConfig(false, false);
        assert.equal(tun.device, "mihomo");
        assert.equal(tun.mtu, 1500);
        assert.equal(tun.enable, false);
    });
});
