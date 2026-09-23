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

## 3. 域名配置（已定案：node-learn.com）

正式域名 **`node-learn.com`**（官网根域）与 **`app.node-learn.com`**（Expo 应用）已写入代码。
换域名牵动全栈，涉及以下文件——改其中任何一处时，必须同步检查其余各处：

| 文件 | 字段 | 当前值 |
|---|---|---|
| `site/astro.config.mjs` | `site:` | `https://node-learn.com` |
| `site/public/robots.txt` | `Sitemap:` | `https://node-learn.com/sitemap-index.xml` |
| `site/src/data/site.ts` | `SITE.url` / `appUrl` / `email.*` | `node-learn.com` / `app.node-learn.com` |
| `site/src/data/legal.ts` | 正文内联系邮箱 | `privacy@` / `legal@node-learn.com` |
| `eas.json` | `EXPO_PUBLIC_WEB_URL`（preview + production） | `https://app.node-learn.com` |
| `app.json` | Android App Link `intentFilters[].data.host` | `app.node-learn.com` |
| `appwrite.config.json` | `CORS_ORIGINS` | 含 `https://app.node-learn.com,https://node-learn.com` |

`site/astro.config.mjs` 的 `site:` 决定 canonical URL 与 `sitemap-index.xml`，漏改会让
全站 SEO 指向错误域名；`robots.txt` 里的 Sitemap 地址不会自动跟随，必须手动同步。

### 仍需在外部系统完成的动作

代码已就绪，但以下操作在 Appwrite Console / DNS / OAuth 服务商侧，**代码改动不会自动生效**：

1. **推送 Function 变量** — `appwrite.config.json` 的 `CORS_ORIGINS` 只是源文件；线上
   Function 需执行 `npm run api:push-vars` 才会更新（CLI 27.x 的 `push --with-variables` 无效）。
   未推送前，来自 `https://node-learn.com` 的请求会因缺少 ACAO 头被浏览器拦截。
2. **Appwrite Sites 自定义域名** — Console → Sites → Domains 绑定 `node-learn.com`，等待
   SSL 签发。
3. **OAuth redirect** — Google 与 Notion 的 provider 配置需加入新的 `app.node-learn.com`
   回调地址，否则第三方登录在正式域名下会失败。
4. **Android App Link 校验** — `app.node-learn.com` 需提供
   `/.well-known/assetlinks.json`，`autoVerify` 才能通过。
5. **法务文案** — `site/src/data/legal.ts` 与 `src/content/legal.ts` 仍是 MVP 草稿，
   页面已标注 "MVP draft, pending legal review"。定稿后两处都要更新。

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

