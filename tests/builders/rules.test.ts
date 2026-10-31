import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildRules, GOOGLE_PLAY_CN_HOST_REGEX } from "../../src/builders/rules";
import { PROXY_GROUPS } from "../../src/catalog/group-names";
import { ruleSets } from "../../src/catalog/rule-sets";

describe("buildRules", () => {
    it("未启用 quic 时插入 UDP 443 拦截规则", () => {
        const rules = buildRules({ quicEnabled: false, hasTailscale: false });
        assert.equal(rules[0], "AND,((DST-PORT,443),(NETWORK,UDP)),REJECT");
    });

    it("启用 quic 时不插入拦截规则", () => {
        const rules = buildRules({ quicEnabled: true, hasTailscale: false });
        assert.ok(!rules.some((rule) => rule.startsWith("AND,")));
    });

    it("Tailscale 存在时生成对应分流规则", () => {
        const rules = buildRules({ quicEnabled: true, hasTailscale: true });
        assert.ok(rules.includes("IP-CIDR,100.64.0.0/10,Tailscale,no-resolve"));
        assert.ok(rules.includes("DOMAIN-SUFFIX,ts.net,Tailscale"));
    });

    it("Tailscale 不存在时不生成对应分流规则", () => {
        const rules = buildRules({ quicEnabled: true, hasTailscale: false });
        assert.ok(!rules.some((rule) => rule.includes("Tailscale")));
    });

    it("默认不生成进程规则", () => {
        const rules = buildRules({ quicEnabled: true, hasTailscale: false });
        assert.ok(!rules.some((rule) => rule.startsWith("PROCESS-NAME,")));
    });

    it("procdirect 生成直连的进程规则，并排在域名规则之前", () => {
        const rules = buildRules({
            quicEnabled: true,
            hasTailscale: false,
            directProcesses: ["GenshinImpact.exe", "League of Legends.exe"],
        });

        assert.ok(rules.includes("PROCESS-NAME,GenshinImpact.exe,DIRECT"));
        assert.ok(rules.includes("PROCESS-NAME,League of Legends.exe,DIRECT"));

        const firstProcess = rules.findIndex((rule) => rule.startsWith("PROCESS-NAME,"));
        const firstRuleSet = rules.findIndex((rule) => rule.startsWith("RULE-SET,"));
        assert.ok(firstProcess < firstRuleSet, "进程规则必须排在域名/规则集规则之前");
    });

    it("procdirect 支持完整路径，生成 PROCESS-PATH 规则", () => {
        const rules = buildRules({
            quicEnabled: true,
            hasTailscale: false,
            directProcesses: ["D:/Riot Games/VALORANT/live/VALORANT.exe"],
        });

        assert.ok(rules.includes("PROCESS-PATH,D:/Riot Games/VALORANT/live/VALORANT.exe,DIRECT"));
        assert.ok(!rules.some((rule) => rule.startsWith("PROCESS-NAME,D:/")));
    });

    it("procproxy 把进程固定到选择代理", () => {
        const rules = buildRules({
            quicEnabled: true,
            hasTailscale: false,
            proxyProcesses: ["WeChat.exe"],
        });

        assert.ok(rules.includes(`PROCESS-NAME,WeChat.exe,${PROXY_GROUPS.SELECT}`));
    });

    it("所有引用的规则集均已注册", () => {
        const rules = buildRules({ quicEnabled: true, hasTailscale: true });
        for (const rule of rules) {
            if (!rule.startsWith("RULE-SET,")) continue;
            const key = rule.split(",")[1];
            assert.ok(key in ruleSets, `未注册的规则集: ${key}`);
        }
    });

    it("所有已注册的规则集都会被规则引用", () => {
        const rules = buildRules({ quicEnabled: true, hasTailscale: true });
        const referenced = new Set(
            rules.filter((rule) => rule.startsWith("RULE-SET,")).map((rule) => rule.split(",")[1])
        );

        for (const key of Object.keys(ruleSets)) {
            assert.ok(referenced.has(key), `规则集已注册但没有规则引用: ${key}`);
        }
    });

    it("ZCode 规则集接入 AI 服务分组", () => {
        const rules = buildRules({ quicEnabled: true, hasTailscale: false });
        assert.ok(rules.includes(`RULE-SET,ZCode,${PROXY_GROUPS.AI_SERVICE}`));
    });

    it("以 MATCH 收尾", () => {
        const rules = buildRules({ quicEnabled: true, hasTailscale: false });
        assert.equal(rules.at(-1), "MATCH,Final");
    });

    it("Google Play 国内 CDN 节点直连，且优先于 Google 代理规则", () => {
        const rules = buildRules({ quicEnabled: true, hasTailscale: false });
        const regexRule = rules.find((rule) => rule.startsWith("DOMAIN-REGEX,"));
        assert.ok(regexRule, "缺少 Google Play 国内 CDN 正则规则");
        assert.equal(regexRule, `DOMAIN-REGEX,${GOOGLE_PLAY_CN_HOST_REGEX},DIRECT`);

        const googleProxyIndex = rules.indexOf(`GEOSITE,google,${PROXY_GROUPS.GOOGLE}`);
        assert.ok(
            rules.indexOf(regexRule) < googleProxyIndex,
            "正则规则必须排在 Google 代理规则之前"
        );
    });

    it("Google Play 国内 CDN 正则只匹配大陆节点", () => {
        const pattern = new RegExp(GOOGLE_PLAY_CN_HOST_REGEX);

        // 北京(2x3)、上海(ni5)、广州(j5o)，`---` 与 `.` 两种连接符
        assert.ok(pattern.test("rr1---sn-j5o76n7z.xn--ngstr-lra8j.com"));
        assert.ok(pattern.test("rr4---sn-j5o7dn7s.xn--ngstr-lra8j.com"));
        assert.ok(pattern.test("rr1.sn-2x3ab123.xn--ngstr-lra8j.com"));
        assert.ok(pattern.test("rr5.sn-ni5zzz99.xn--ngstr-lra8j.com"));

        // 境外节点（a5m）与同类但非 Ångström 域名不应命中
        assert.ok(!pattern.test("rr1---sn-a5mekn7r.xn--ngstr-lra8j.com"));
        assert.ok(!pattern.test("rr1---sn-j5o76n7z.googlevideo.com"));
        assert.ok(!pattern.test("rr1---sn-j5o76n7z.xn--ngstr-lra8j.com.evil.test"));
    });
});
