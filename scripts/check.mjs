import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const dist = path.join(root, "dist");
const required = ["index.html", "styles.css", "app.js", "site.config.json", "data/templates.json", "demo/mp-001/index.html", "demo/mp-001/demo-runtime.js", "demo/mp-001/manifest.json", "templates/mp-001/index.html"];
const fail = (message) => { throw new Error(message); };
for (const file of required) if (!fs.existsSync(path.join(dist, file))) fail(`缺少构建文件: ${file}`);

const templates = JSON.parse(fs.readFileSync(path.join(dist, "data/templates.json"), "utf8"));
if (!templates.some((template) => template.id === "mp-001" && template.status === "available")) fail("MP-001 配置缺失");
for (const template of templates) if (!fs.existsSync(path.join(dist, "templates", template.id, "index.html"))) fail(`模板详情路由缺失: ${template.id}`);

const manifest = JSON.parse(fs.readFileSync(path.join(dist, "demo/mp-001/manifest.json"), "utf8"));
if (!manifest.includes("miniprogram/app.json") || !manifest.includes("miniprogram/pages/home/index.wxml")) fail("MP-001 manifest 不完整");
for (const file of manifest) if (!fs.existsSync(path.join(dist, "demo/mp-001", file))) fail(`Demo 资源缺失: ${file}`);

const config = JSON.parse(fs.readFileSync(path.join(dist, "demo/mp-001/miniprogram/config/client.json"), "utf8"));
if (config.backendMode !== "MOCK" || config.apiBaseUrl || config.cloudbaseEnv) fail("MP-001 不是安全的 Mock 配置");
const runtime = fs.readFileSync(path.join(dist, "demo/mp-001/demo-runtime.js"), "utf8");
if (runtime.includes("/preview/manifest") || runtime.includes("/preview/file/")) fail("Demo 仍依赖母版开发服务器");
if (runtime.includes("http://") || runtime.includes("https://")) fail("Demo runtime 含外部请求地址");
console.log(JSON.stringify({ status: "PASS", templates: templates.length, demoFiles: manifest.length, viewport: "390x844", backend: "MOCK" }, null, 2));
