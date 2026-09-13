import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");

function copyDirectory(source, destination) {
  fs.cpSync(source, destination, { recursive: true, force: true });
}

function readJson(relative) {
  return JSON.parse(fs.readFileSync(path.join(root, relative), "utf8"));
}

function listFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? listFiles(absolute) : [absolute];
  });
}

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });
copyDirectory(path.join(root, "src"), dist);
copyDirectory(path.join(root, "public"), dist);
fs.copyFileSync(path.join(root, "site.config.json"), path.join(dist, "site.config.json"));

const templates = readJson("src/data/templates.json");
const detailSource = fs.readFileSync(path.join(root, "src/template-detail.html"), "utf8");
for (const template of templates) {
  const route = path.join(dist, "templates", template.id, "index.html");
  fs.mkdirSync(path.dirname(route), { recursive: true });
  fs.writeFileSync(route, detailSource.replaceAll("__TEMPLATE_ID__", template.id));
}
fs.rmSync(path.join(dist, "template-detail.html"), { force: true });

const demoRoot = path.join(dist, "demo", "mp-001");
const miniprogramRoot = path.join(demoRoot, "miniprogram");
const manifest = listFiles(miniprogramRoot)
  .map((file) => path.relative(demoRoot, file).replaceAll(path.sep, "/"))
  .sort();
fs.writeFileSync(path.join(demoRoot, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

const bytes = listFiles(dist).reduce((sum, file) => sum + fs.statSync(file).size, 0);
console.log(`Built static gallery → dist (${listFiles(dist).length} files, ${bytes} bytes)`);
