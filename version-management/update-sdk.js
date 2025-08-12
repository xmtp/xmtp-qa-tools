// ESM script (package.json has type: module)
import fs from "node:fs";
import path from "node:path";

const REGISTRY_BASE = "https://registry.npmjs.org";

async function fetchJson(url) {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return res.json();
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, obj) {
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2) + "\n");
}

function versionToSuffix(version) {
  // "4.0.3" -> "403", "3.2.10" -> "3210"
  return version.split(".").join("");
}

function ensureDependencyAlias(deps, alias, target) {
  if (!deps[alias]) {
    deps[alias] = target;
    return true;
  }
  return false;
}

function insertImportIfMissing(source, importBlock) {
  if (source.includes(importBlock)) return source;
  // Insert imports before the first `export {` block to keep structure
  const exportIndex = source.indexOf("\nexport {");
  if (exportIndex === -1) {
    // fallback: append at top
    return importBlock + "\n" + source;
  }
  return (
    source.slice(0, exportIndex) +
    importBlock +
    "\n" +
    source.slice(exportIndex)
  );
}

function insertVersionListEntry(source, entryText) {
  if (source.includes(entryText)) return source;
  const marker = "export const VersionList = [";
  const idx = source.indexOf(marker);
  if (idx === -1)
    throw new Error("VersionList array not found in client-versions.ts");
  const insertPos = idx + marker.length;
  // Insert as first element after opening bracket
  return (
    source.slice(0, insertPos) + "\n  " + entryText + source.slice(insertPos)
  );
}

async function main() {
  const repoRoot = process.cwd();
  const pkgPath = path.join(repoRoot, "package.json");
  const clientVersionsPath = path.join(
    repoRoot,
    "version-management",
    "client-versions.ts",
  );

  const pkg = readJson(pkgPath);
  const deps = pkg.dependencies || (pkg.dependencies = {});

  // 1) Get latest @xmtp/node-sdk version
  const sdkLatest = await fetchJson(`${REGISTRY_BASE}/@xmtp/node-sdk/latest`);
  const sdkVersion = sdkLatest.version;

  const sdkAlias = `@xmtp/node-sdk-${sdkVersion}`;
  const sdkTarget = `npm:@xmtp/node-sdk@${sdkVersion}`;

  if (deps[sdkAlias]) {
    console.log(`No update needed. Latest SDK already present: ${sdkVersion}`);
  } else {
    console.log(`New SDK detected: ${sdkVersion}`);

    // Fallback: get latest bindings
    const bindingsLatest = await fetchJson(
      `${REGISTRY_BASE}/@xmtp/node-bindings/latest`,
    );
    const bindingsVersion = bindingsLatest.version;

    const bindingsAlias = `@xmtp/node-bindings-${bindingsVersion}`;
    const bindingsTarget = `npm:@xmtp/node-bindings@${bindingsVersion}`;

    let changed = false;
    changed = ensureDependencyAlias(deps, sdkAlias, sdkTarget) || changed;
    changed =
      ensureDependencyAlias(deps, bindingsAlias, bindingsTarget) || changed;

    if (changed) {
      writeJson(pkgPath, pkg);
      console.log(
        "package.json updated with new aliases:",
        sdkAlias,
        bindingsAlias,
      );
    }

    // 3) Update client-versions.ts
    let clientSrc = fs.readFileSync(clientVersionsPath, "utf8");

    if (!clientSrc.includes(`@xmtp/node-sdk-${sdkVersion}`)) {
      const suffix = versionToSuffix(sdkVersion);
      const importBlock = `import {\n  Client as Client${suffix},\n  Conversation as Conversation${suffix},\n  Dm as Dm${suffix},\n  Group as Group${suffix},\n} from "@xmtp/node-sdk-${sdkVersion}";\n`;

      clientSrc = insertImportIfMissing(clientSrc, importBlock);

      const entry = `{
    Client: Client${suffix},
    Conversation: Conversation${suffix},
    Dm: Dm${suffix},
    Group: Group${suffix},
    nodeSDK: "${sdkVersion}",
    nodeBindings: "${bindingsVersion}",
    auto: false,
  },\n`;

      clientSrc = insertVersionListEntry(clientSrc, entry);

      fs.writeFileSync(clientVersionsPath, clientSrc);
      console.log(
        "version-management/client-versions.ts updated with new version mapping",
      );
    } else {
      console.log(
        "client-versions.ts already references this SDK version; skipping edits",
      );
    }
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
