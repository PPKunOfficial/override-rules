/**
 * 按进程名分流：解析 URL 参数里的进程名列表。
 *
 * 规则行用逗号分列，所以净化的第一要务是绝不把带逗号（或其他分隔符）的内容
 * 拼进规则——否则一条参数就能把后面的规则列挤歪，生成出内核无法解析的配置。
 * 除了过滤分隔符，这里也限制长度与字符集，避免误传整段命令或路径。
 */

/** 单个进程名的最大长度，防止误把整段命令当成进程名。 */
const MAX_PROCESS_NAME_LENGTH = 64;

/** 合法进程名字符集：字母、数字、点、下划线、连字符、加号、空格（如 `League of Legends.exe`）。 */
const PROCESS_NAME_PATTERN = /^[A-Za-z0-9._+\- ]+$/;

/**
 * 解析以 `,` / `|` / `;` / 换行分隔的进程名列表。
 *
 * 重复项按大小写不敏感去重（Windows 进程名不区分大小写），保留首次出现的写法。
 * @param raw - 原始参数值，例如 `GenshinImpact.exe|League of Legends.exe`
 */
export function parseProcessNames(raw?: string): string[] {
    if (!raw) return [];

    const seen = new Set<string>();
    const names: string[] = [];

    for (const part of raw.split(/[,|;\n]+/)) {
        const name = part.trim();
        if (name.length === 0 || name.length > MAX_PROCESS_NAME_LENGTH) continue;
        if (!PROCESS_NAME_PATTERN.test(name)) continue;

        const key = name.toLowerCase();
        if (seen.has(key)) continue;

        seen.add(key);
        names.push(name);
    }

    return names;
}
