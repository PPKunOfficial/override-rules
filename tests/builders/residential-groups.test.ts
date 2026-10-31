import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { analyzeNodes } from "../../src/analysis/classify";
import { buildFeatureFlags } from "../../src/args/parse";
import { buildProxyGroups } from "../../src/builders/proxy-groups";
import { buildBaseLists } from "../../src/builders/selectors";
import { countryGroupName, PROXY_GROUPS } from "../../src/catalog/group-names";
import type { ScriptArgs } from "../../src/types/args";
import type { ProxyGroup, ProxyNode } from "../../src/types/proxy";

function buildGroups(args: ScriptArgs, proxies: ProxyNode[]): ProxyGroup[] {
    const flags = buildFeatureFlags(args);
    const nodes = analyzeNodes(proxies, flags.countryThreshold);
    const lists = buildBaseLists({
        landing: nodes.landing,
        landingNodes: nodes.landingNodes,
        lowCostNodes: nodes.lowCostNodes,
        hasResidentialPicker: nodes.manualNames.length > 0,
        nonLandingNodes: nodes.nonLandingNodes,
        tailscaleNodes: nodes.tailscaleNodes,
        regexFilter: flags.regexFilter,
        regions: nodes.regionLayout,
    });

    return buildProxyGroups({ flags, nodes, lists });
}

function group(groups: ProxyGroup[], name: string): ProxyGroup | undefined {
    return groups.find((item) => item.name === name);
}

const NODES: ProxyNode[] = [
    { name: "香港01" },
    { name: "香港家宽01" },
    { name: "台湾01" },
    { name: "台湾02" },
    { name: "日本省流" },
    { name: "日本家宽01" },
    { name: "美国01" },
    { name: "美国家宽 AT&T 02" },
];

describe("家宽节点组", () => {
    it("不做名称匹配，直接列出全部节点（保持原顺序）", () => {
        const groups = buildGroups({}, NODES);

        assert.deepEqual(group(groups, PROXY_GROUPS.RESIDENTIAL)?.proxies, [
            "香港01",
            "香港家宽01",
            "台湾01",
            "台湾02",
            "日本省流",
            "日本家宽01",
            "美国01",
            "美国家宽 AT&T 02",
        ]);
    });

    it("不生成任何按地区的家宽子组", () => {
        const groups = buildGroups({}, NODES);
        const names = groups.map((item) => item.name);

        assert.equal(
            names.some((name) => name.includes("家宽") && name !== PROXY_GROUPS.RESIDENTIAL),
            false
        );
    });

    it("排在地区组之后，且地区组数量不受影响", () => {
        const groups = buildGroups({}, NODES);
        const names = groups.map((item) => item.name);
        const picker = names.indexOf(PROXY_GROUPS.RESIDENTIAL);

        assert.ok(picker >= 0, "应生成家宽节点组");
        for (const country of ["香港", "台湾", "日本", "美国"]) {
            const region = names.indexOf(countryGroupName(country));
            assert.ok(region >= 0, `应生成 ${countryGroupName(country)}`);
            assert.ok(region < picker, `${countryGroupName(country)} 应排在家宽节点组之前`);
        }
    });

    it("regex 模式下用 include-all 填充，不再叠加名称过滤器", () => {
        const groups = buildGroups({ regex: "true" }, NODES);
        const picker = group(groups, PROXY_GROUPS.RESIDENTIAL);

        assert.equal(picker?.["include-all"], true);
        assert.equal(picker?.filter, undefined);
        assert.equal(picker?.proxies, undefined);
    });

    it("家宽节点组排除 Tailscale", () => {
        const groups = buildGroups({}, [...NODES, { name: "ts-node", type: "tailscale" }]);

        assert.equal(group(groups, PROXY_GROUPS.RESIDENTIAL)?.proxies?.includes("ts-node"), false);
        assert.equal(
            group(groups, PROXY_GROUPS.RESIDENTIAL)?.proxies?.length,
            NODES.length,
            "其余节点应全部保留"
        );
    });

    it("regex 模式下家宽节点组排除 Tailscale", () => {
        const groups = buildGroups({ regex: "true" }, [
            ...NODES,
            { name: "ts-node", type: "tailscale" },
        ]);

        assert.equal(group(groups, PROXY_GROUPS.RESIDENTIAL)?.["exclude-filter"], "^(?:ts-node)$");
    });

    it("没有节点时不生成家宽节点组", () => {
        const groups = buildGroups({}, []);

        assert.equal(group(groups, PROXY_GROUPS.RESIDENTIAL), undefined);
    });

    it("内容与「手动选择」一致，且进入选择代理与服务组候选", () => {
        const groups = buildGroups({}, NODES);

        assert.deepEqual(
            group(groups, PROXY_GROUPS.RESIDENTIAL)?.proxies,
            group(groups, PROXY_GROUPS.MANUAL)?.proxies
        );
        assert.ok(group(groups, PROXY_GROUPS.SELECT)?.proxies?.includes(PROXY_GROUPS.RESIDENTIAL));
        assert.ok(group(groups, PROXY_GROUPS.GOOGLE)?.proxies?.includes(PROXY_GROUPS.RESIDENTIAL));
    });

    it("展平模式下同样生成家宽节点组", () => {
        const groups = buildGroups({}, [{ name: "香港01" }, { name: "日本省流" }]);

        assert.deepEqual(group(groups, PROXY_GROUPS.RESIDENTIAL)?.proxies, ["香港01", "日本省流"]);
        assert.equal(group(groups, PROXY_GROUPS.MANUAL), undefined);
    });
});
