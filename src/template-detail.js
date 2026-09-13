const templateId = document.body.dataset.templateId;
const templates = await fetch("../../data/templates.json", { cache: "no-store" }).then((response) => response.json());
const template = templates.find((item) => item.id === templateId);

const setText = (selector, value) => {
  const element = document.querySelector(selector);
  if (element) element.textContent = value || "";
};

if (!template) {
  setText("[data-detail-title]", "模板不存在");
  setText("[data-detail-status]", "暂未收录");
} else {
  document.title = `${template.title} · 小宇模板中心`;
  setText("[data-detail-id]", template.id.toUpperCase());
  setText("[data-detail-title]", template.title);
  setText("[data-detail-status]", template.statusLabel);
  setText("[data-detail-description]", template.description);
  setText("[data-detail-note]", template.demoNote || "新的真实交互模板将在完成验收后上线。");

  for (const [selector, values] of [["[data-detail-use-cases]", template.useCases], ["[data-detail-features]", template.features]]) {
    const target = document.querySelector(selector);
    for (const value of values) {
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.textContent = value;
      target.append(chip);
    }
  }

  const cta = document.querySelector("[data-detail-cta]");
  const demoSection = document.querySelector("[data-detail-demo-section]");
  if (template.status === "available") {
    cta.href = template.previewUrl;
    document.querySelector("[data-detail-iframe]").src = template.previewUrl;
  } else {
    cta.textContent = "加入等待列表";
    cta.href = "/#templates";
    demoSection.hidden = true;
  }
}
