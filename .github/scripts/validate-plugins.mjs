#!/usr/bin/env node
/**
 * Validates that all EmDash/Plugdash plugin packages installed in this project:
 * 1. Ship compiled JavaScript (not raw TypeScript source)
 * 2. Declare a peer dependency on emdash that covers the installed version
 *
 * Catches issues like emdash-plugin-cookie-consent which exports ./src/index.ts
 * instead of a compiled dist — causing silent runtime failures in the Worker.
 */
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

const emdashPkgPath = "node_modules/emdash/package.json";
const emdashVersion = existsSync(emdashPkgPath)
  ? JSON.parse(readFileSync(emdashPkgPath, "utf8")).version
  : null;

const PLUGIN_PATTERN = /(emdash|plugdash).*(plugin)|plugin.*(emdash|plugdash)/i;
const pluginPackages = Object.keys(allDeps).filter((name) =>
  PLUGIN_PATTERN.test(name)
);

if (pluginPackages.length === 0) {
  console.log("No plugin packages found — nothing to validate.");
  process.exit(0);
}

console.log(`Validating ${pluginPackages.length} plugin package(s)...\n`);

let failed = false;

for (const pkgName of pluginPackages) {
  const pkgJsonPath = `node_modules/${pkgName}/package.json`;
  if (!existsSync(pkgJsonPath)) {
    console.warn(`⚠️  ${pkgName}: not installed, skipping`);
    continue;
  }

  const pluginPkg = JSON.parse(readFileSync(pkgJsonPath, "utf8"));

  // ── Check 1: exports must not point to raw .ts files ─────────────────────
  const exports = pluginPkg.exports;
  if (exports) {
    const flatten = (v) => {
      if (typeof v === "string") return [v];
      if (typeof v === "object" && v !== null)
        return Object.values(v).flatMap(flatten);
      return [];
    };
    const exportPaths = flatten(exports);
    const tsExports = exportPaths.filter((v) => v.endsWith(".ts"));

    if (tsExports.length > 0) {
      console.error(`❌ ${pkgName}`);
      console.error(
        `   Exports raw TypeScript source — package has no compiled dist:`
      );
      tsExports.forEach((p) => console.error(`   • ${p}`));
      console.error(
        `   The Worker cannot load uncompiled TypeScript at runtime.`
      );
      console.error(
        `   Either wait for a published release with a dist/, or copy the`
      );
      console.error(`   source into src/plugins/ and wire it locally.\n`);
      failed = true;
    } else {
      console.log(`✅ ${pkgName}: exports compiled output`);
    }
  }

  // ── Check 2: peer dep emdash version must cover installed version ─────────
  const peerDeps = pluginPkg.peerDependencies ?? {};
  if (peerDeps.emdash && emdashVersion) {
    let satisfied = true;
    try {
      const semver = require("semver");
      satisfied = semver.satisfies(emdashVersion, peerDeps.emdash);
    } catch {
      // semver not available — fall back to a naive major.minor check
      const [peerMajor] = peerDeps.emdash.replace(/[\^~>=<]/g, "").split(".");
      const [installedMajor] = emdashVersion.split(".");
      satisfied = peerMajor === installedMajor;
    }

    if (!satisfied) {
      console.error(`❌ ${pkgName}`);
      console.error(
        `   Peer dep emdash@${peerDeps.emdash} is not satisfied by installed emdash@${emdashVersion}`
      );
      console.error(
        `   The plugin was built against a different emdash major/minor — API`
      );
      console.error(`   changes may cause silent failures at runtime.\n`);
      failed = true;
    } else {
      console.log(
        `✅ ${pkgName}: peer dep emdash@${peerDeps.emdash} satisfied by ${emdashVersion}`
      );
    }
  }
}

console.log();
if (failed) {
  console.error("Plugin validation failed. Fix the issues above before merging.");
  process.exit(1);
} else {
  console.log("All plugin packages passed validation.");
}
