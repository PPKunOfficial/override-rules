import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
    GAME_NETWORK_PRESETS,
    normalizeCidr,
    parseTunExclude,
} from "../../src/catalog/game-networks";

describe("normalizeCidr", () => {
    it("接受合法的 IPv4 / IPv6 网段", () => {
        assert.equal(normalizeCidr("162.249.72.0/21"), "162.249.72.0/21");
        assert.equal(normalizeCidr(" 1.1.1.1/32 "), "1.1.1.1/32");
        assert.equal(normalizeCidr("2400:3200::/32"), "2400:3200::/32");
    });

    it("纯 IPv4 补成 /32", () => {
        assert.equal(normalizeCidr("8.8.8.8"), "8.8.8.8/32");
    });

    it("丢弃越界与格式错误的输入", () => {
        assert.equal(normalizeCidr("999.1.1.1/24"), null);
        assert.equal(normalizeCidr("1.2.3.4/33"), null);
        assert.equal(normalizeCidr("1.2.3/24"), null);
        assert.equal(normalizeCidr("cs2"), null);
        assert.equal(normalizeCidr(""), null);
    });
});

describe("parseTunExclude", () => {
    it("展开预设名", () => {
        const addresses = parseTunExclude("valorant");
        assert.deepEqual(addresses, [...GAME_NETWORK_PRESETS.valorant]);
        assert.equal(addresses[0], "43.229.64.0/22");
    });

    it("预设名大小写不敏感，多个预设合并去重", () => {
        const addresses = parseTunExclude("CS2,valorant,cs2");
        assert.equal(
            addresses.length,
            GAME_NETWORK_PRESETS.cs2.length + GAME_NETWORK_PRESETS.valorant.length
        );
        assert.equal(new Set(addresses).size, addresses.length);
    });

    it("预设与自定义网段混写", () => {
        const addresses = parseTunExclude("1.2.3.0/24|cs2");
        assert.equal(addresses[0], "1.2.3.0/24");
        assert.equal(addresses.length, GAME_NETWORK_PRESETS.cs2.length + 1);
    });

    it("未知预设与非法条目被丢弃", () => {
        assert.deepEqual(parseTunExclude("csgo|999.1.1.1/24|"), []);
        assert.deepEqual(parseTunExclude(undefined), []);
    });
});
