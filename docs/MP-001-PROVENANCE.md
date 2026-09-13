# MP-001 来源与公开边界

## 来源

MP-001 直接复用：

`D:\Codex\01_App-应用开发\003_Xianyu-MiniProgram-Factory-闲鱼小程序定制工厂\01_Repository\xianyu-miniapp-factory`

本地构建入口是 `pnpm run build`，浏览器辅助 Preview 入口是 `pnpm run admin` 后访问 `http://127.0.0.1:4173/preview`。Gallery 不复制母版仓库，而是将母版当前 `dist/miniprogram` 构建产物作为独立站点的 MP-001 Demo 资产，配合静态 Preview runtime 发布。

母版当次复验：

- TypeScript：PASS
- ESLint：PASS
- 业务测试：15/15 PASS
- 原生构建：11 页 PASS
- 静态检查：PASS
- Preview 页面、底部 Tab、服务列表、服务详情：浏览器已实际操作

## 公开 Demo 边界

- `backendMode` 保持 `MOCK`。
- `apiBaseUrl` 与 `cloudbaseEnv` 为空。
- 预约只写入当前浏览器的本地存储，不产生真实订单、支付、消息或生产数据变更。
- 公开 Preview 是浏览器辅助渲染器，不冒充微信开发者工具或真机运行时。
- `cloudbase.js` 与 `rest.js` 作为母版 Provider 契约的一部分保留，但 MP-001 配置不会调用它们。

## 未宣称事项

真实微信开发者工具编译、真实 AppID、CloudBase 联调、支付、备案与微信审核不属于本网站公开 Demo 的 PASS 证据。
