import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const scanRoots = ["src", "public", "scripts", "site.config.json", "package.json"];
const forbiddenNames = /(^|[._-])(env|pem|key|jks|keystore|p12|pfx|sqlite|db|backup)([._-]|$)/i;
const secretPatterns = [/-----BEGIN [A-Z ]+-----/, /\bAKIA[0-9A-Z]{16}\b/, /\bsk-[A-Za-z0-9]{20,}\b/, /(?:secret|password|privateKey|accessToken)\s*[:=]\s*["'][^"']{8,}["']/i];
const files = [];
function walk(entry) {
  const absolute = path.join(root, entry);
  if (fs.statSync(absolute).isFile()) return files.push(absolute);
  for (const child of fs.readdirSync(absolute)) walk(path.join(entry, child));
}
for (const entry of scanRoots) walk(entry);
const findings = [];
for (const file of files) {
  if (forbiddenNames.test(path.basename(file))) findings.push(`${path.relative(root, file)}: forbidden filename`);
  const text = fs.readFileSync(file, "utf8");
  for (const pattern of secretPatterns) if (pattern.test(text)) findings.push(`${path.relative(root, file)}: possible secret`);
}
const config = JSON.parse(fs.readFileSync(path.join(root, "src/data/templates.json"), "utf8"));
if (JSON.stringify(config).match(/apiKey|secret|token/i)) findings.push("template config contains credential-like field");
if (findings.length) { console.error(findings.join("\n")); process.exit(1); }
console.log(JSON.stringify({ status: "PASS", filesScanned: files.length, secretsUploaded: "NO", productionDataUploaded: "NO" }, null, 2));
