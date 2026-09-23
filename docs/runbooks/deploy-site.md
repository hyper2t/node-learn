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

### CLI 方式（已实测，推荐）

站点已声明在 `appwrite.config.json` 的 `sites` 块中（`$id: node-learn-site`，
`path: "site"`），属于配置即代码，与 `functions` 的管理方式一致。在**仓库根目录**执行：

```powershell
appwrite push site --all --force
```

CLI 会上传 `site/` 源码，在云端跑 `npm install` + `npm run build`，发布 `dist/`。
整个过程约 54 秒。首次执行已自动创建 proxy rule 与默认域名。

> `path` 字段必须是 `site`。`appwrite pull site` 会把它重置为 `sites/<id>`（不存在的目录），
> 每次 pull 之后都要改回来，否则推送上去的是空内容。
> 另外 `appwrite pull site` 默认带 `--code`，会覆盖本地源码——务必加 `--no-code`。

**当前部署地址**：<https://6ab3bc7e000f6444e2f2.appwrite.network>（14 条路由全部实测 200）

### npm 镜像源与云端构建冲突（重要）

本机 `~/.npmrc` 指向 `registry.npmmirror.com`，会把 330 个 mirror URL 写进
`package-lock.json`。Appwrite 构建沙箱拒绝抓取此类 "remote" tarball，报错：

```
npm error code EALLOWREMOTE
npm error Refusing to fetch "zwitch@https://registry.npmmirror.com/..."
```

因此仓库内置了 `site/.npmrc` 固定使用 `registry.npmjs.org`。**不要删除它。**

若 lockfile 被污染（检查方法：`Select-String -Path site/package-lock.json -Pattern npmmirror`
应为 0 条），需重新生成。注意本机 npm 会复用镜像缓存、生成不含 `resolved`/`integrity`
字段的残缺 lockfile，仅靠 `--registry` 参数无法绕过；可靠做法是在干净环境重新生成，
或先 `npm cache clean --force` 再执行：

```powershell
cd site
Remove-Item package-lock.json
npm install --package-lock-only
```

生成后校验：`resolved` 与 `registry.npmjs.org` 均应为 330 条，`npmmirror` 为 0。

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

1. **注册 Web 平台**（✅ 2026-09-23 已完成）— Appwrite 会校验 OAuth 的 `success` 回调
   URL 必须属于已注册平台，否则 Google/Notion 登录跳转时报：

   ```
   Error 400 · general_argument_invalid
   Invalid `success` param: Invalid URI. Register your new client (app.node-learn.com)
   as a new Web platform on your project console dashboard
   ```

   这不是代码问题，`src/infrastructure/appwrite/oauth.ts` 无需改动。补注册即可：

   ```powershell
   appwrite project create-web-platform `
     --platform-id web-app-node-learn-com `
     --name "Node Learn Web (app.node-learn.com)" `
     --hostname "app.node-learn.com"
   ```

   查看现有平台：`appwrite project list-platforms`。当前 4 个：apple / android /
   `node-learn-alpha.vercel.app` / `app.node-learn.com`。
   **每新增一个可访问应用的域名（含 Vercel 预览域名），都要补一条 Web 平台。**

2. **推送 Function 变量**（✅ 已生效）— `appwrite.config.json` 的 `CORS_ORIGINS` 只是源文件；
   线上 Function 需执行 `npm run api:push-vars` 才会更新（CLI 27.x 的 `push --with-variables` 无效）。
   未推送前，来自新域名的请求会因缺少 ACAO 头被浏览器拦截。

   实测验证方法（不要只读配置，变量值在 CLI 里是隐藏的）：

   ```powershell
   Invoke-WebRequest -Uri "https://6ab25202000c575857b2.appwrite.network/v1/me" -Method Options `
     -Headers @{ "Origin"="https://app.node-learn.com"; "Access-Control-Request-Method"="GET" } `
     -UseBasicParsing | ForEach-Object { $_.Headers["Access-Control-Allow-Origin"] }
   ```

   应返回 `https://app.node-learn.com`。
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

