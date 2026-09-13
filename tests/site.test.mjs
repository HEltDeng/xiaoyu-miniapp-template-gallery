import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(".");
const templates = JSON.parse(fs.readFileSync(path.join(root, "src/data/templates.json"), "utf8"));

test("template catalog has one available demo and future slots", () => {
  assert.equal(templates.filter((item) => item.status === "available").length, 1);
  assert.deepEqual(templates.filter((item) => item.status === "coming").map((item) => item.id), ["mp-002", "mp-003", "mp-004"]);
});

test("MP-001 is explicitly Mock and has no backend endpoints", () => {
  const config = JSON.parse(fs.readFileSync(path.join(root, "public/demo/mp-001/miniprogram/config/client.json"), "utf8"));
  assert.equal(config.backendMode, "MOCK");
  assert.equal(config.apiBaseUrl, "");
  assert.equal(config.cloudbaseEnv, "");
});

test("public demo keeps the native preview viewport contract", () => {
  const html = fs.readFileSync(path.join(root, "public/demo/mp-001/index.html"), "utf8");
  assert.match(html, /width=390/);
  assert.match(html, /Mock 演示模式/);
});
