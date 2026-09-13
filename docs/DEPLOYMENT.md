# 模板中心部署说明

## 本地

```powershell
node scripts/build.mjs
node scripts/server.mjs
```

默认地址为 `http://127.0.0.1:5173/`。Preview 内的 MP-001 是静态资源，不依赖母版的 4173 管理服务器。

## 生产目标

目标站点：`https://templates.mychangliapp.cn/`

第一版采用 Nginx 静态托管，不新增 Node 常驻服务、数据库、Docker 或 API。建议独立目录：

```text
/var/www/templates-mychangliapp
```

现有 `mychangliapp.cn` 的 root、API 反向代理和证书配置必须保持不变。新增站点使用独立 `server_name templates.mychangliapp.cn`，独立 `root`，并通过 `try_files $uri $uri/ =404` 提供静态目录与模板详情目录。

`demo/mp-001/` 的 Preview runtime 使用 `new Function` 将 WXML 辅助渲染为浏览器 DOM，因此仅对该路径允许 `script-src 'unsafe-eval'`；Gallery 页面本身不需要该权限。生产配置示例见 `deploy/nginx-templates.conf.example`。

## DNS

需要一条解析记录：

```text
类型：A
主机记录：templates
记录值：现有 mychangliapp.cn 官网使用的腾讯云服务器公网 IPv4
```

记录值必须以实时 DNS/服务器检查为准，不在仓库中写入示例 IP。DNS 是否能自动修改取决于当前腾讯云 DNS 授权，不因 SSH 可用而默认成立。

## HTTPS

DNS 生效后，为 `templates.mychangliapp.cn` 配置证书；HTTP 访问必须 301 到 HTTPS。证书申请、Nginx `-t`、reload、站点首页、Demo 资源、Mixed Content、原官网和 API 回归检查都要分别记录。
