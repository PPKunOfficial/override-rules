import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildFeatureFlags } from "../../src/args/parse";
import { parseProcessNames } from "../../src/catalog/processes";
import { ARG_DEFAULTS } from "../../src/args/schema";

describe("buildFeatureFlags", () => {
    it("无参数时使用默认值", () => {
        const flags = buildFeatureFlags({});
        assert.equal(flags.groupType, ARG_DEFAULTS.groupType);
        assert.equal(flags.countryThreshold, ARG_DEFAULTS.countryThreshold);
        assert.equal(flags.fakeIPEnabled, true);
        assert.equal(flags.ipv6Enabled, false);
        assert.equal(flags.regexFilter, false);
    });

    it("解析 grouptype 的合法取值", () => {
        assert.equal(buildFeatureFlags({ grouptype: "0" }).groupType, 0);
        assert.equal(buildFeatureFlags({ grouptype: "1" }).groupType, 1);
        assert.equal(buildFeatureFlags({ grouptype: "2" }).groupType, 2);
    });

    it("非法 grouptype 回退为默认值", () => {
        assert.equal(buildFeatureFlags({ grouptype: "9" }).groupType, ARG_DEFAULTS.groupType);
    });

    it("向后兼容 loadbalance", () => {
        assert.equal(buildFeatureFlags({ loadbalance: "true" }).groupType, 2);
        assert.equal(buildFeatureFlags({ loadbalance: "false" }).groupType, 1);
        // 显式 grouptype 优先于 loadbalance
        assert.equal(buildFeatureFlags({ loadbalance: "true", grouptype: "0" }).groupType, 0);
        assert.equal(buildFeatureFlags({ loadbalance: "false", grouptype: "2" }).groupType, 2);
        // grouptype 未指定或非法时才回退到 loadbalance
        assert.equal(buildFeatureFlags({ loadbalance: "true", grouptype: "9" }).groupType, 2);
    });

    it("fakeip 显式传 false 时关闭", () => {
        assert.equal(buildFeatureFlags({ fakeip: "false" }).fakeIPEnabled, false);
    });

    it("解析 procdirect / procproxy", () => {
        const flags = buildFeatureFlags({
            procdirect: "GenshinImpact.exe|League of Legends.exe",
            procproxy: "WeChat.exe",
        });
        assert.deepEqual(flags.directProcesses, ["GenshinImpact.exe", "League of Legends.exe"]);
        assert.deepEqual(flags.proxyProcesses, ["WeChat.exe"]);
    });
});

describe("parseProcessNames", () => {
    it("支持逗号、竖线、分号与换行分隔", () => {
        assert.deepEqual(parseProcessNames("a.exe,b.exe|c.exe;d.exe\ne.exe"), [
            "a.exe",
            "b.exe",
            "c.exe",
            "d.exe",
            "e.exe",
        ]);
    });

    it("过滤空项与大小写重复", () => {
        assert.deepEqual(parseProcessNames(" a.exe , A.EXE ,, "), ["a.exe"]);
    });

    it("过滤含分隔符、路径与超长内容的非法项", () => {
        assert.deepEqual(parseProcessNames("C:\Games\a.exe"), []);
        assert.deepEqual(parseProcessNames("bad*name.exe"), []);
        assert.deepEqual(parseProcessNames(`${"x".repeat(70)}.exe`), []);
    });
});
