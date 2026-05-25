import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import assert from "node:assert/strict";

const projectRoot = fileURLToPath(new URL("../../", import.meta.url));
const sourceRoot = resolve(projectRoot, "src");

const toProjectPath = (path) => relative(projectRoot, path).split(sep).join("/");

const listFiles = (root) => {
  const entries = readdirSync(root)
    .map((entry) => resolve(root, entry))
    .sort();
  const files = [];

  for (const entry of entries) {
    if (statSync(entry).isDirectory()) {
      files.push(...listFiles(entry));
      continue;
    }

    if (entry.endsWith(".js") || entry.endsWith(".mjs")) {
      files.push(entry);
    }
  }

  return files;
};

const sourceFiles = listFiles(sourceRoot);

const extractImportSpecifiers = (source) => {
  const specifiers = [];
  const patterns = [
    /\bimport\s+(?:[\s\S]*?\s+from\s*)?["'](?<specifier>[^"']+)["']/g,
    /\bimport\s*\(\s*["'](?<specifier>[^"']+)["']\s*\)/g,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(source)) !== null) {
      specifiers.push(match.groups.specifier);
    }
  }

  return specifiers;
};

const resolveLocalImport = (filePath, specifier) => {
  if (!specifier.startsWith(".")) return null;
  return toProjectPath(resolve(dirname(filePath), specifier));
};

const readSourceFile = (filePath) => readFileSync(filePath, "utf8");

const forbiddenLayerImports = [
  {
    prefix: "src/core/",
    forbidden: ["src/ui/", "src/render/", "src/audio/"],
  },
  {
    prefix: "src/systems/",
    forbidden: ["src/ui/", "src/render/", "src/audio/", "src/runtime/", "src/testing/"],
  },
  {
    prefix: "src/state/",
    forbidden: ["src/ui/", "src/render/", "src/audio/", "src/runtime/", "src/testing/"],
  },
  {
    prefix: "src/render/",
    forbidden: ["src/ui/", "src/audio/", "src/runtime/", "src/testing/", "src/state/"],
  },
  {
    prefix: "src/audio/",
    forbidden: ["src/ui/", "src/render/", "src/systems/", "src/state/", "src/runtime/", "src/testing/"],
  },
  {
    prefix: "src/ui/",
    forbidden: ["src/render/", "src/audio/", "src/systems/", "src/runtime/", "src/testing/"],
  },
  {
    prefix: "src/events/",
    forbidden: ["src/ui/", "src/render/", "src/audio/", "src/systems/", "src/state/", "src/runtime/", "src/testing/"],
  },
  {
    prefix: "src/fx/",
    forbidden: ["src/ui/", "src/render/", "src/audio/", "src/systems/", "src/state/", "src/runtime/", "src/testing/"],
  },
];

test("src modules keep imports inside the source tree except for the module entry", () => {
  for (const filePath of sourceFiles) {
    const projectPath = toProjectPath(filePath);
    const imports = extractImportSpecifiers(readSourceFile(filePath)).map((specifier) =>
      resolveLocalImport(filePath, specifier),
    );

    for (const target of imports.filter(Boolean)) {
      if (projectPath === "src/main.js") {
        assert.ok(
          target === "src/runtime/moduleBridge.js" || target === "game.js",
          `${projectPath} should only import the bridge and browser host, not ${target}`,
        );
        continue;
      }

      assert.ok(target.startsWith("src/"), `${projectPath} should not import outside src/: ${target}`);
    }
  }
});

test("source modules respect architecture dependency direction", () => {
  for (const filePath of sourceFiles) {
    const projectPath = toProjectPath(filePath);
    const layerRule = forbiddenLayerImports.find(({ prefix }) => projectPath.startsWith(prefix));
    if (!layerRule) continue;

    const imports = extractImportSpecifiers(readSourceFile(filePath))
      .map((specifier) => resolveLocalImport(filePath, specifier))
      .filter(Boolean);

    for (const target of imports) {
      for (const forbiddenPrefix of layerRule.forbidden) {
        assert.equal(
          target.startsWith(forbiddenPrefix),
          false,
          `${projectPath} must not import ${target}; ${layerRule.prefix} cannot depend on ${forbiddenPrefix}`,
        );
      }
    }
  }
});

test("extracted boundary modules avoid host globals", () => {
  const hostGlobalPattern = /\b(window|document|localStorage|sessionStorage)\b/;
  const hostFiles = new Set(["src/main.js", "src/runtime/moduleBridge.js"]);

  for (const filePath of sourceFiles) {
    const projectPath = toProjectPath(filePath);
    if (hostFiles.has(projectPath)) continue;

    assert.doesNotMatch(readSourceFile(filePath), hostGlobalPattern, `${projectPath} should not access host globals`);
  }
});
