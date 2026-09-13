# 小宇模板中心 · 小程序模板交互体验中心

独立的模板 Gallery 产品。它的核心不是展示截图，而是在网页中加载真实可操作的 390 × 844 小程序 Preview。

## 第一版

- `MP-001`：栖间 · 生活服务
- 首页、模板卡片、模板详情路由、定制流程与后续模板占位位
- 静态 Gallery + 静态 Demo，默认 Mock，不连接真实订单、支付、消息、生产 API 或 CloudBase
- MP-001 复用闲鱼小程序定制工厂母版的当前构建产物，不重新编写假的小程序 Demo

## 开发

```powershell
node scripts/build.mjs
node scripts/check.mjs
node scripts/security-scan.mjs
node --test tests/*.test.mjs
node scripts/server.mjs
```

浏览器访问 `http://127.0.0.1:5173/`。

## 数据驱动扩展

模板目录位于 `src/data/templates.json`。新增 MP-002 的最小步骤：

1. 将经过安全检查的 Demo 构建资产放入 `public/demo/mp-002/`，入口为 `index.html`。
2. 在 `src/data/templates.json` 增加一条 `status: "available"` 配置，填写 `previewUrl`、`detailUrl`、适用场景和功能。
3. 运行 build、check、security-scan 和浏览器验收；build 会自动生成 `/templates/mp-002/` 详情目录。

占位模板只能使用 `status: "coming"`，不写虚构功能。

## 重要边界

真实微信开发者工具、真实账号、CloudBase、支付、备案、审核和商店发布，不能由本项目的浏览器 Preview 代替。来源与公开边界见 [docs/MP-001-PROVENANCE.md](docs/MP-001-PROVENANCE.md)，生产配置边界见 [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)。
