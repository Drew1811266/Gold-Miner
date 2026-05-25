import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

function parseScriptTags(html) {
  const scriptTagPattern = /<script\b(?<attributes>[^>]*)>/gi;
  const attributePattern = /([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  const scripts = [];
  let scriptMatch;

  while ((scriptMatch = scriptTagPattern.exec(html)) !== null) {
    const attributes = {};
    const attributeText = scriptMatch.groups.attributes;
    let attributeMatch;

    while ((attributeMatch = attributePattern.exec(attributeText)) !== null) {
      const [, rawName, doubleQuotedValue, singleQuotedValue, unquotedValue] = attributeMatch;
      attributes[rawName.toLowerCase()] = doubleQuotedValue ?? singleQuotedValue ?? unquotedValue ?? "";
    }

    scripts.push(attributes);
  }

  return scripts;
}

const isModuleScript = ({ type }) => type?.trim().toLowerCase() === "module";

test("index boots audio before the module entry", () => {
  const scripts = parseScriptTags(read("index.html"));
  const audioScriptIndex = scripts.findIndex(({ src }) => src === "./audio.js");
  const mainScriptIndex = scripts.findIndex(({ src }) => src === "./src/main.js");
  const gameScriptIndex = scripts.findIndex(({ src }) => src === "./game.js");

  assert.notEqual(audioScriptIndex, -1, "index.html should load audio.js");
  assert.notEqual(mainScriptIndex, -1, "index.html should load src/main.js");
  assert.equal(gameScriptIndex, -1, "index.html should no longer load game.js directly");
  assert.ok(audioScriptIndex < mainScriptIndex, "audio.js must load before the module entry");
  assert.equal(isModuleScript(scripts[audioScriptIndex]), false, "audio.js must remain classic");
  assert.equal(isModuleScript(scripts[mainScriptIndex]), true, "src/main.js must be a module script");
});

test("main entry installs bridge before importing the browser host", () => {
  const source = read("src/main.js");

  assert.match(source, /^import "\.\/runtime\/moduleBridge\.js";/);
  assert.match(source, /await import\("\.\.\/game\.js"\)/);
  assert.ok(
    source.indexOf('import "./runtime/moduleBridge.js";') < source.indexOf('await import("../game.js")'),
    "module bridge should be imported before game.js",
  );
});

test("main entry reports import failures through the existing boot error global", () => {
  const source = read("src/main.js");

  assert.match(source, /catch \(error\)/);
  assert.match(source, /window\.__goldMinerBootError = error instanceof Error \? error\.message : String\(error\);/);
  assert.match(source, /console\.error\("Gold Miner module entry failed\.", error\);/);
});
