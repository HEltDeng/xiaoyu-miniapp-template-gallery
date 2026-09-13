const templates = await loadJson("/data/templates.json");
const config = await loadJson("/site.config.json");

function loadJson(path) {
  return fetch(path, { cache: "no-store" }).then((response) => {
    if (!response.ok) throw new Error(`配置加载失败: ${path}`);
    return response.json();
  });
}

function createChip(text) {
  const chip = document.createElement("span");
  chip.className = "chip";
  chip.textContent = text;
  return chip;
}

function createTemplateCard(template) {
  const card = document.createElement("article");
  card.className = `template-card ${template.status === "available" ? "available" : "coming"}`;

  const top = document.createElement("div");
  top.className = "card-top";
  const id = document.createElement("span");
  id.className = "card-id";
  id.textContent = template.id.toUpperCase();
  const status = document.createElement("span");
  status.className = "card-status";
  status.textContent = template.statusLabel;
  top.append(id, status);

  const visual = document.createElement("div");
  visual.className = "card-visual";
  const mark = document.createElement("span");
  mark.className = "card-visual-mark";
  mark.textContent = template.status === "available" ? "↗" : "…";
  visual.append(mark);

  const content = document.createElement("div");
  content.className = "card-content";
  const title = document.createElement("h3");
  title.textContent = template.title;
  const description = document.createElement("p");
  description.textContent = template.description;
  const chips = document.createElement("div");
  chips.className = "chip-row";
  for (const item of [...template.useCases, ...template.features].slice(0, 4)) chips.append(createChip(item));
  content.append(title, description, chips);

  const actions = document.createElement("div");
  actions.className = "card-actions";
  const detail = document.createElement("a");
  detail.className = "card-link";
  detail.href = template.detailUrl;
  detail.textContent = "查看详情 ";
  const detailArrow = document.createElement("span");
  detailArrow.textContent = "↗";
  detail.append(detailArrow);
  const experience = document.createElement("a");
  experience.className = `card-link ${template.status === "available" ? "" : "disabled-link"}`;
  experience.href = template.status === "available" ? template.previewUrl : template.detailUrl;
  experience.textContent = template.status === "available" ? "在线体验 " : "即将上线 ";
  const experienceArrow = document.createElement("span");
  experienceArrow.textContent = template.status === "available" ? "↗" : "—";
  experience.append(experienceArrow);
  actions.append(experience, detail);

  card.append(top, visual, content, actions);
  return card;
}

const grid = document.querySelector("[data-template-grid]");
for (const template of templates) grid.append(createTemplateCard(template));

const processGrid = document.querySelector("[data-process-grid]");
for (const step of config.sections.process) {
  const item = document.createElement("article");
  item.className = "process-step";
  item.innerHTML = `<p class="process-step-label"></p><h3></h3><p></p>`;
  item.querySelector(".process-step-label").textContent = step.label;
  item.querySelector("h3").textContent = step.title;
  item.querySelector("p:last-child").textContent = step.text;
  processGrid.append(item);
}

const primary = templates.find((template) => template.status === "available");
if (primary) document.querySelector("#hero-demo-title").textContent = primary.title;

function sizeDevice(stageSelector, shellSelector, topbarHeight = 38, contentHeight = 844) {
  const stage = document.querySelector(stageSelector);
  const shell = document.querySelector(shellSelector);
  if (!stage || !shell) return;
  const parent = stage.parentElement;
  const update = () => {
    const scale = Math.min(1, parent.clientWidth / 390);
    shell.style.setProperty("--device-scale", scale.toFixed(4));
    stage.style.width = `${390 * scale}px`;
    stage.style.height = `${(topbarHeight + contentHeight) * scale}px`;
  };
  new ResizeObserver(update).observe(parent);
  update();
}

sizeDevice("[data-device-stage]", "[data-device-shell]");
