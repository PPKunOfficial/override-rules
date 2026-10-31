/**
 * 内置 PC 游戏进程清单。
 *
 * 这里只收「对局本体」的可执行文件：登录器、商店、启动器（`steam.exe`、
 * `RiotClientServices.exe`、`Battle.net.exe` 等）一律不收，否则更新下载与商店
 * 会被一并按游戏规则处理，社区和创意工坊会打不开。
 *
 * 同时刻意避开 `javaw.exe`、`game.exe`、`Client-Win64-Shipping.exe` 这类
 * 过于通用的名字——它们命中的往往是别的东西。
 *
 * 命中后进入「PC 游戏」组，默认 `DIRECT`；想改成走节点，在面板里切换该组即可，
 * 或用 `pcgame=false` 关掉整组规则，再按需用 `procdirect` / `procproxy` 精确点名。
 */
export const PC_GAME_PROCESSES = [
    // Valve
    "cs2.exe",
    "csgo.exe",
    "dota2.exe",
    // Riot / 腾讯系
    "VALORANT-Win64-Shipping.exe",
    "VALORANT.exe",
    "League of Legends.exe",
    "TslGame.exe",
    "NarakaBladepoint.exe",
    "DeltaForceClient-Win64-Shipping.exe",
    "crossfire.exe",
    // 米哈游
    "YuanShen.exe",
    "GenshinImpact.exe",
    "StarRail.exe",
    "ZenlessZoneZero.exe",
    // 暴雪
    "Wow.exe",
    "WowClassic.exe",
    "Overwatch.exe",
    "Diablo IV.exe",
    // 其它常见对局客户端
    "r5apex.exe",
    "RainbowSix.exe",
    "bf2042.exe",
    "cod.exe",
    "destiny2.exe",
    "EscapeFromTarkov.exe",
    "aces.exe",
    "Warframe.x64.exe",
    "LOSTARK.exe",
] as const;
