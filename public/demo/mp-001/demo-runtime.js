function modal(title, content, cancel, callback) {
  const d = document.createElement("dialog");
  const h = document.createElement("h3");
  h.textContent = title;
  const p = document.createElement("p");
  p.textContent = content;
  d.append(h, p);
  for (const yes of cancel ? [false, true] : [true]) {
    const b = document.createElement("button");
    b.textContent = yes ? "确定" : "取消";
    b.className = yes ? "primary" : "secondary";
    b.onclick = () => {
      d.close();
      d.remove();
      callback?.({ confirm: yes });
    };
    d.append(b);
  }
  document.body.append(d);
  d.showModal();
}
const files = await (await fetch("./manifest.json")).json(),
  cache = {},
  sources = {};
await Promise.all(
  files
    .filter((p) => /\.(js|json|wxml|wxss)$/.test(p))
    .map(
      async (p) =>
        (sources[p] = await (await fetch("./" + p)).text()),
    ),
);
const css = document.createElement("style");
css.textContent = sources["miniprogram/app.wxss"]
  .replace(/:root,page/g, ":root,body")
  .replace(/(\d+(?:\.\d+)?)rpx/g, (_, n) => Number(n) / 2 + "px")
  .replace(/(^|[\s,])image(?=[\s.{:#])/g, "$1img");
document.head.append(css);
function normalize(p) {
  const a = [];
  for (const s of p.split("/"))
    if (s === "..") a.pop();
    else if (s !== "." && s) a.push(s);
  return a.join("/");
}
function requireFile(p) {
  if (!/\.(json|js)$/.test(p)) p += ".js";
  if (cache[p]) return cache[p].exports;
  const m = { exports: {} };
  cache[p] = m;
  if (p.endsWith(".json")) m.exports = JSON.parse(sources[p]);
  else
    new Function("require", "module", "exports", "wx", "Page", sources[p])(
      (q) =>
        requireFile(normalize(p.split("/").slice(0, -1).join("/") + "/" + q)),
      m,
      m.exports,
      wx,
      (x) => (current = x),
    );
  return m.exports;
}
let current,
  route = "miniprogram/pages/home/index",
  query = {};
const app = JSON.parse(sources["miniprogram/app.json"]);
const wx = {
  getStorageSync: (k) => JSON.parse(localStorage.getItem(k) || "null"),
  setStorageSync: (k, v) => localStorage.setItem(k, JSON.stringify(v)),
  removeStorageSync: (k) => localStorage.removeItem(k),
  showToast: (x) => modal(x.title, "", false),
  showModal: (x) =>
    modal(x.title, x.content, x.showCancel !== false, x.success),
  navigateTo: (x) => navigate(x.url),
  switchTab: (x) => navigate(x.url),
  makePhoneCall: (x) => alert(x.phoneNumber),
};
async function navigate(url) {
  const [p, q] = url.replace(/^\//, "").split("?");
  route = p.startsWith("miniprogram/") ? p : "miniprogram/" + p;
  query = Object.fromEntries(new URLSearchParams(q));
  delete cache[route + ".js"];
  requireFile(route + ".js");
  current.data = structuredClone(current.data);
  current.setData = (x) => {
    Object.assign(current.data, x);
    render();
  };
  current.onLoad?.(query);
  render();
  current.onShow?.();
  window.scrollTo(0, 0);
}
function evaluate(s, ctx) {
  try {
    return new Function("ctx", "with(ctx){return (" + s + ")}")(ctx);
  } catch {
    return "";
  }
}
function expr(s, ctx) {
  const only = s.match(/^\{\{([^{}]*?)\}\}$/);
  return only
    ? evaluate(only[1], ctx)
    : s.replace(/\{\{([\s\S]*?)\}\}/g, (_, x) => evaluate(x, ctx) ?? "");
}
function eventData(node, ctx) {
  return Object.fromEntries(
    [...node.attributes]
      .filter((a) => a.name.startsWith("data-"))
      .map((a) => [a.name.slice(5), expr(a.value, ctx)]),
  );
}
function renderNode(node, ctx) {
  if (node.nodeType === 3)
    return document.createTextNode(expr(node.textContent, ctx));
  if (node.nodeType !== 1) return document.createTextNode("");
  if (node.hasAttribute("wx:for")) {
    const f = document.createDocumentFragment(),
      items = expr(node.getAttribute("wx:for"), ctx) || [];
    items.forEach((item, index) => {
      const copy = node.cloneNode(true);
      copy.removeAttribute("wx:for");
      f.append(renderNode(copy, { ...ctx, item, index }));
    });
    return f;
  }
  if (node.hasAttribute("wx:if") && !expr(node.getAttribute("wx:if"), ctx))
    return document.createTextNode("");
  const tag = node.tagName.toLowerCase();
  let e = document.createElement(
    tag === "image"
      ? "img"
      : tag === "picker"
        ? "select"
        : tag === "checkbox"
          ? "input"
          : tag,
  );
  for (const a of node.attributes) {
    if (
      a.name.startsWith("wx:") ||
      a.name.startsWith("bind") ||
      a.name.startsWith("data-") ||
      a.name === "range" ||
      a.name === "range-key" ||
      a.name === "mode"
    )
      continue;
    let v = expr(a.value, ctx);
    if (a.name === "src" && typeof v === "string") {
      if (v.startsWith("/")) v = "./miniprogram" + v;
      else if (v.startsWith("assets/")) v = "./miniprogram/" + v;
    }
    if (["disabled", "hidden", "checked"].includes(a.name)) {
      e[a.name] = !!v;
      continue;
    }
    if (a.name === "value") e.value = v ?? "";
    else e.setAttribute(a.name, v ?? "");
  }
  if (tag === "checkbox") {
    e.type = "checkbox";
    e.checked = !!ctx.consent;
  }
  if (tag === "button")
    e.type = node.getAttribute("form-type") === "submit" ? "submit" : "button";
  if (tag === "picker") {
    const handler = node.getAttribute("bindchange");
    if (node.getAttribute("mode") === "date") {
      e = document.createElement("input");
      e.type = "date";
      e.className = "input";
      e.min = expr(node.getAttribute("start") || "", ctx);
      e.value = ctx.date || "";
    } else {
      e.className = "input";
      const options = expr(node.getAttribute("range"), ctx) || [];
      options.forEach((v, i) => {
        const o = document.createElement("option");
        o.textContent = node.getAttribute("range-key")
          ? v[node.getAttribute("range-key")]
          : v;
        o.value = i;
        e.append(o);
      });
      e.value = expr(node.getAttribute("value"), ctx) || 0;
    }
    e.onchange = () => current[handler]?.({ detail: { value: e.value } });
    return e;
  }
  for (const child of node.childNodes) e.append(renderNode(child, ctx));
  const tap = node.getAttribute("bindtap");
  if (tap)
    e.onclick = (event) => {
      event.stopPropagation();
      current[tap]?.({ currentTarget: { dataset: eventData(node, ctx) } });
    };
  const input = node.getAttribute("bindinput");
  if (input) e.oninput = () => current[input]?.({ detail: { value: e.value } });
  if (tag === "checkbox-group")
    e.onchange = () =>
      current[node.getAttribute("bindchange")]?.({
        detail: {
          value: [...e.querySelectorAll("input:checked")].map((x) => x.value),
        },
      });
  if (tag === "form")
    e.onsubmit = (event) => {
      event.preventDefault();
      current[node.getAttribute("bindsubmit")]?.({
        detail: { value: Object.fromEntries(new FormData(e)) },
      });
    };
  return e;
}
function render() {
  const remembered = Object.fromEntries(
    [...document.querySelectorAll("#app input[name],#app textarea[name]")].map(
      (e) => [e.name, e.value],
    ),
  );
  const active = document.activeElement;
  const focusPlaceholder = active?.getAttribute("placeholder"),
    value = active?.value;
  const template = document.createElement("template");
  template.innerHTML = sources[route + ".wxml"].replace(
    /<([a-z-]+)([^>]*?)\/>/g,
    "<$1$2></$1>",
  );
  const target = document.getElementById("app");
  target.replaceChildren(
    ...[...template.content.childNodes].map((n) => renderNode(n, current.data)),
  );
  for (const input of target.querySelectorAll("input[name],textarea[name]"))
    if (input.name in remembered) input.value = remembered[input.name];
  if (focusPlaceholder) {
    const restored = [...target.querySelectorAll("input,textarea")].find(
      (x) => x.getAttribute("placeholder") === focusPlaceholder,
    );
    if (restored) {
      restored.value = value;
      restored.focus();
    }
  }
  const tabs = document.getElementById("tabs");
  tabs.replaceChildren();
  for (const t of app.tabBar?.list || []) {
    const b = document.createElement("button");
    b.className = t.pagePath === route ? "active" : "";
    const img = document.createElement("img");
    img.src = "./miniprogram/" + (t.pagePath === route ? t.selectedIconPath : t.iconPath);
    b.append(img, document.createTextNode(t.text));
    b.onclick = () => navigate(t.pagePath);
    tabs.append(b);
  }
}
await navigate(route);
