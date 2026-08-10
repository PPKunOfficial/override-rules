import * as esbuild from "esbuild";
import * as fs from "node:fs";
import { execSync } from "node:child_process";

const version = (() => {
    try {
        const tag = execSync("git describe --tags --abbrev=0", { encoding: "utf8" }).trim();
        return tag.replace(/^src-/, "");
    } catch {
        return JSON.parse(fs.readFileSync("package.json", "utf8")).version;
    }
})();

const mainCode = fs.readFileSync("src/main.ts", "utf8");
const bannerMatch = mainCode.match(/\/\*![\s\S]*?\*\//);
const bannerText = (bannerMatch ? bannerMatch[0] : "").replace(/%%VERSION%%/g, version);

const commonOptions = {
    entryPoints: ["src/main.ts"],
    bundle: true,
    platform: "neutral",
    format: "iife",
    target: "ES2025",
    legalComments: "none",
    charset: "utf8",
    banner: { js: bannerText },
};

Promise.all([
    esbuild.build({ ...commonOptions, outfile: "convert.js" }),
    esbuild.build({
        ...commonOptions,
        minify: true,
        outfile: "convert.min.js",
        drop: ["debugger"],
    }),
]).catch((err) => {
    console.error(err);
    process.exit(1);
});
