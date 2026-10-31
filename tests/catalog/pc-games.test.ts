import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { PC_GAME_PROCESSES } from "../../src/catalog/pc-games";

const LOWERED = new Set<string>(PC_GAME_PROCESSES.map((exe) => exe.toLowerCase()));

describe("PC_GAME_PROCESSES", () => {
    it("清单非空且没有重复项", () => {
        assert.ok(PC_GAME_PROCESSES.length > 0);
        assert.equal(LOWERED.size, PC_GAME_PROCESSES.length);
    });

    it("每一项都是可直接拼进 PROCESS-NAME 规则的纯进程名", () => {
        for (const exe of PC_GAME_PROCESSES as readonly string[]) {
            assert.match(exe, /^[A-Za-z0-9._+\- ]+$/, `${exe} 含规则不允许的字符`);
            assert.ok(exe.length <= 64, `${exe} 超长`);
            assert.ok(!/[\\/]/.test(exe), `${exe} 不该带路径分隔符`);
        }
    });

    it("不含会误伤其它程序的通用进程名", () => {
        for (const generic of [
            "javaw.exe",
            "java.exe",
            "game.exe",
            "client.exe",
            "steam.exe",
            "explorer.exe",
            "node.exe",
            "python.exe",
        ]) {
            assert.ok(!LOWERED.has(generic), `${generic} 过于通用，会误伤其它程序`);
        }
    });

    it("不收录启动器与商店，避免连带更新下载和社区", () => {
        for (const launcher of [
            "steam.exe",
            "riotclientservices.exe",
            "battle.net.exe",
            "epicgameslauncher.exe",
        ]) {
            assert.ok(!LOWERED.has(launcher), `${launcher} 是启动器/商店，不该按游戏处理`);
        }
    });

    it("覆盖常见对局客户端", () => {
        for (const exe of [
            "cs2.exe",
            "VALORANT-Win64-Shipping.exe",
            "League of Legends.exe",
            "YuanShen.exe",
            "TslGame.exe",
        ]) {
            assert.ok(LOWERED.has(exe.toLowerCase()), `缺少 ${exe}`);
        }
    });
});
