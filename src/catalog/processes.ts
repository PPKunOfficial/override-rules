/**
 * 按进程分流：解析 URL 参数里的进程名 / 进程路径列表。
 *
 * 规则行用逗号分列，所以净化的第一要务是绝不把带逗号（或其他分隔符）的内容
 * 拼进规则——否则一条参数就能把后面的规则列挤歪，生成出内核无法解析的配置。
 * 除了过滤分隔符，这里也限制长度与字符集，避免误传整段命令。
 *
 * 参数里给纯文件名（如 `GenshinImpact.exe`）生成 `PROCESS-NAME`，
 * 给完整路径（如 `D:\Games\VALORANT\VALORANT.exe`）生成 `PROCESS-PATH`。
 */

/** 单个进程名的最大长度，防止误把整段命令当成进程名。 */
const MAX_PROCESS_NAME_LENGTH = 64;

/** 单个进程路径的最大长度（Windows MAX_PATH）。 */
const MAX_PROCESS_PATH_LENGTH = 260;

/** 合法进程名字符集：字母、数字、点、下划线、连字符、加号、空格（如 `League of Legends.exe`）。 */
const PROCESS_NAME_PATTERN = /^[A-Za-z0-9._+\- ]+$/;

/**
 * 合法进程路径字符集：进程名允许的字符 + 反斜杠、正斜杠、冒号。
 *
 * 逗号、竖线、分号一律不允许——它们是参数分隔符，混进来会切歪规则行。
 */
const PROCESS_PATH_PATTERN = /^[A-Za-z0-9._+\- \\/:]+$/;

/** 路径特征：含目录分隔符或盘符前缀。 */
const PROCESS_PATH_HINT = /[\\/]|^[A-Za-z]:/;

/**
 * 判断一条参数应生成 `PROCESS-NAME` 还是 `PROCESS-PATH` 规则。
 *
 * 进程名本身不会含目录分隔符，因此带 `\`、`/` 或以盘符开头的条目即视为路径。
 * @param value - 已净化的条目
 */
export function processRuleType(value: string): "PROCESS-NAME" | "PROCESS-PATH" {
    return PROCESS_PATH_HINT.test(value) ? "PROCESS-PATH" : "PROCESS-NAME";
}

/**
 * 规范 Windows 绝对路径：`D:/Games/a.exe` 与 `D:\\Games\\a.exe` 都写成反斜杠形式。
 *
 * 内核按进程可执行文件的真实路径做**大小写敏感**的精确比较，Windows 返回的是反斜杠
 * 形式，所以正斜杠写法永远不会命中——这里直接转换掉，避免静默失效。
 * 非 Windows 路径（如 `/usr/bin/foo`）原样保留。
 * @param value - 已通过字符校验的路径
 */
export function normalizeProcessPath(value: string): string {
    return /^[A-Za-z]:[\\/]/.test(value) ? value.replace(/\//g, "\\") : value;
}

/**
 * 解析以 `,` / `|` / `;` / 换行分隔的进程名或进程路径列表。
 *
 * 重复项按大小写不敏感去重（Windows 进程名与路径不区分大小写），保留首次出现的写法。
 * 超长项、含非法字符项一律丢弃，由调用方忽略。
 * @param raw - 原始参数值，例如 `GenshinImpact.exe|League of Legends.exe`
 *                    或 `D:\Games\VALORANT\VALORANT.exe`
 */
export function parseProcessNames(raw?: string): string[] {
    if (!raw) return [];

    const seen = new Set<string>();
    const values: string[] = [];

    for (const part of raw.split(/[,|;\n]+/)) {
        let value = part.trim();
        if (value.length === 0) continue;

        const isPath = processRuleType(value) === "PROCESS-PATH";
        if (isPath) value = normalizeProcessPath(value);
        if (value.length > (isPath ? MAX_PROCESS_PATH_LENGTH : MAX_PROCESS_NAME_LENGTH)) continue;
        if (!(isPath ? PROCESS_PATH_PATTERN : PROCESS_NAME_PATTERN).test(value)) continue;

        const key = value.toLowerCase();
        if (seen.has(key)) continue;

        seen.add(key);
        values.push(value);
    }

    return values;
}
