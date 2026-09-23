# Runbook — deploy the marketing site (Appwrite Sites)

范围：`site/`（Astro 静态门户）。与 `functions/` 的 API 部署互不影响，见 `deploy-api.md`。

---

## 1. 本地验证

在 `site/` 下执行（Windows PowerShell 用 `;` 串联，**不要用 `&&`**）：

```powershell
cd site
npm install
npm run build      # 产物 -> site/dist，应为 13 个页面
npm run preview    # 本地预览构建结果
```

Node 要求 `>= 22.12`。本机 npm 源为 `registry.npmmirror.com`，其 Astro 最高版本为 7.3.3，
因此 `package.json` 锁定 `^7.3.3`（不要写成 `^7.3.4`，镜像源上不存在会 ETARGET 失败）。

> 并发跑两次 `npm install` 会互相覆盖并留下残缺的 `node_modules`（症状：
> `Cannot find module astro/dist/cli/index.js`）。遇到时删除 `node_modules` 与
> `package-lock.json` 后重装。

---

## 2. Appwrite Sites 配置

Console → **Sites** → Create site → Connect a repository：

| 设置项 | 值 |
|---|---|
| Framework | `Astro` |
| Root directory | `site` |
| Production branch | `main` |
| Install command | `npm install` |
| Build command | `npm run build` |
| Output directory | `./dist` |
| Build runtime | `node-22` |

Root directory 必须填 `site`，否则 Appwrite 会在仓库根目录构建 Expo 应用。

CLI 方式（在 `site/` 下）：

```powershell
appwrite deploy site
```

---

## 3. 上线前必改

1. **域名** — `site/astro.config.mjs` 的 `site:` 字段目前是 `https://node-learn.example`。
   它决定 canonical URL 与 `sitemap-index.xml` 的内容，换正式域名后必须同步修改，
   同时更新 `site/public/robots.txt` 里的 Sitemap 地址。
2. **邮箱地址** — `site/src/data/site.ts` 的 `SITE.email.*` 全是 `*.example` 占位符。
3. **应用入口** — `SITE.appUrl` 指向 `https://app.node-learn.example`，需改为真实的
   Expo Web 部署地址。
4. **法务文案** — `site/src/data/legal.ts` 是从 `src/content/legal.ts` 复制的 MVP 草稿，
   页面上已明确标注 "MVP draft, pending legal review"。法务定稿后两处都要更新。

---

## 4. 与应用代码的同步点

| 站点文件 | 同步来源 | 说明 |
|---|---|---|
| `site/src/styles/global.css` | `src/styles/tokens/palette.js` | 调色板、字阶、圆角、间距 |
| `site/src/data/legal.ts` | `src/content/legal.ts` | Privacy / Terms 正文 |
| `site/src/data/site.ts` (`TOPICS`) | `src/content/topics.ts` | 话题标签 |

站点刻意不 import 应用源码：它是独立的 npm 包，不依赖 Expo/Metro 构建链，
所以上述内容是复制而非引用，改动时需手动同步。

**Tailwind v4 注意**：`@theme` 不能嵌套在 `@media` 里，否则暗色值会泄漏到亮色模式。
`global.css` 采用的方案是 `:root` 声明 `--nl-*` 变量 + `@media` 覆盖，`@theme` 只做引用——
与应用 `tailwind.config.js` 的 CSS 变量思路一致。

---

## 5. 端口

| 服务 | 端口 |
|---|---|
| Hono BFF | 8070 |
| Expo Web | 8071 |
| Astro 站点 | 4321 |

三者可同时运行。

