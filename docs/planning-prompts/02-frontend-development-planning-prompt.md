# React Native 前端开发规划提示词

> 将以下整段提示词交给前端架构/开发规划 Agent。目标是产出可按阶段执行的开发计划、目录与契约方案，不立即大规模编码。

---

你是一名资深 React Native / Expo 跨端架构师。请为 `E:\node-learn-en` 制定 `KnowNode` 全球英语版的前端开发规划。目标是用一个 React Native 代码库支持 iOS、Android 和 Web，同时实现学生端与老师端，保持极简、可访问、可离线恢复，并与 TypeScript + Appwrite 混合 BFF 后端协作。

## 1. 先做真实基线审计

在规划前必须读取：

### 目标项目 `E:\node-learn-en`

- `AGENTS.md`
- `package.json`
- `app.json`
- `tsconfig.json`
- `src/app/**`
- `src/components/**`
- `src/constants/**`
- `src/hooks/**`

确认实际版本后，再读取对应 Expo 精确文档。当前已知基线是 Expo SDK 57、React Native 0.86.3、React 19.2.3、Expo Router 57，路由目录是 `src/app/`；如果仓库已变化，以实际文件为准。不得根据记忆使用 Expo API。任何 Expo 依赖必须先查 v57 文档，并通过 `npx expo install` 安装兼容版本。

### 现有知节点 `E:\zhijiedian`

重点分析并提炼，不直接复制：

- `docs/zhijiedian-philosophy-and-engineering-constraints.md`
- `docs/zhijiedian-mvp-frontend-architecture.md`
- `docs/student-teacher-web-implementation-plan.md`
- `docs/im-chat-system-prd.md`
- `app/(internal)/**`
- `src/application/navigation/**`
- `src/application/roles/**`
- `src/application/providers/**`
- `src/domains/identity/**`
- `src/domains/learning/**`
- `src/domains/matching/**`
- `src/domains/messaging/**`
- `src/domains/proof/**`
- `src/domains/teacher/**`
- `src/infrastructure/**`
- `src/state/**`
- `src/shared/**`

必须保留的架构思想：薄 Route Layer、Application/Domain/Infrastructure 分层、领域内聚的 queries/store、角色路由、共享导航元数据、TanStack Query 管服务端状态、Zustand 管少量客户端状态、`LearningRelation` 为内核、消息是类型化协作事件。

同时识别现有项目的警示：不要重建超大 Screen，不要把消息、学习首页或老师工作台写成数千行组件；不要让 mock 与真实 API 长期分叉；不要将所有状态塞进一个全局 store。

### 参考项目 `E:\proto-store`

重点阅读：

- `package.json`
- `src/app/**`
- `src/components/ui/**`
- `src/components/layout/**`
- `src/features/auth/**`
- `src/lib/appwrite/client.native.ts`
- `src/lib/appwrite/client.web.ts`
- `src/lib/appwrite/index.ts`
- `src/lib/api/client.ts`
- `src/lib/query/**`
- `src/lib/storage/**`
- `src/hooks/use-breakpoint.ts`

参考其 Expo 57、平台文件、Appwrite Account facade、内存 JWT 缓存、401 单次刷新、TanStack Query、Zod/RHF、NativeWind 和响应式布局做法；不要复制电商领域或多余依赖。

输出开头列出版本基线、可复用模式、需要改造的模式和不能确认的事项。

## 2. 前端产品范围

实现以下最小闭环：

```text
Auth → role onboarding → learning goal
→ teacher search/invite/application
→ LearningRelation workspace
→ goals/tasks/structured messages
→ evidence submission/feedback
→ simple proof/progress projection
```

双角色主导航最多四项：

- Student：`Home / Messages / Learning / Profile`
- Teacher：`Workbench / Messages / Students / Profile`

移动端用底部导航；桌面 Web 用侧栏/双栏布局；导航 metadata 必须共享。匹配、申请中心、联系人、设置、详情页是二级路由。

明确不做：实名认证、手机号短信体系、支付/订单/钱包、复杂知识图谱画布、社交 Feed、粉丝系统、复杂好友推荐、直播、音视频通话、自治 AI。

## 3. 目标技术方向

请验证后给出最终选型，优先保持与 `E:\proto-store` 接近：

- Expo SDK 57 + Expo Router typed routes。
- React Native Web，共享业务组件，必要时使用 `.web.tsx` / `.native.tsx` 适配。
- `@tanstack/react-query` 管理服务端状态、失效、重试和分页。
- `zustand` 只管理认证之外的轻量客户端 UI 状态、草稿和当前筛选；不得创建 mega store。
- `react-hook-form` + `zod` 管理表单和边界校验。
- `appwrite`（Web）+ `react-native-appwrite`（native）封装统一 Account/Realtime facade。
- **样式方案已冻结为 NativeWind（Tailwind CSS）**，不再另做是否采用的 ADR，只需做版本与配置 ADR：
  - 先查 NativeWind 官方文档与 Expo SDK 57 / React Native 0.86 / Reanimated 4 / Worklets 的兼容矩阵，固定一个稳定版本（含配套 `tailwindcss` 版本），安装依赖走 `npx expo install`，并说明 `babel.config.js`、`metro.config.js`、`global.css`、`nativewind-env.d.ts` 与 `tailwind.config` 的接入步骤。
  - design tokens 是唯一事实来源：颜色、间距、圆角、字号、断点、语义状态色全部放入 `tailwind.config` 的 theme 扩展（可由 `src/styles/tokens` 生成），组件只引用语义 class（如 `bg-surface`、`text-muted`），禁止在 JSX 中散落任意色值或魔法数字。
  - 用 `className` 作为默认样式手段，`StyleSheet`/inline style 只允许用于 NativeWind 无法表达的动态值（如动画、测量结果），并在评审规则中写明。
  - 规划 class 组合工具（如 `cva`/`tailwind-variants` + `clsx`/`tailwind-merge`）用于 `shared/ui` 变体，避免长串条件 class；说明是否需要 `dark:` 支持与 Web/native 差异（如 Web 上的 hover/focus-visible）。
  - 交付一个 NativeWind 冒烟验证：iOS、Android、Web 三端各渲染一个使用 token class 的组件并通过 `npx tsc --noEmit` 与 lint。
- 持久化优先使用 Expo 官方模块。认证会话由 Appwrite SDK 管理；不要把 Appwrite JWT 持久化或写日志。
- 环境变量以根目录 `.env.example` 为准，变量名沿用 `E:\proto-store`：`EXPO_PUBLIC_APPWRITE_ENDPOINT`、`EXPO_PUBLIC_APPWRITE_PROJECT_ID`、`EXPO_PUBLIC_APPWRITE_PROJECT_NAME`、`EXPO_PUBLIC_APPWRITE_PLATFORM`、`EXPO_PUBLIC_API_BASE_URL`（本地 `http://localhost:8070`）、`EXPO_PUBLIC_API_MOCK`、`EXPO_PUBLIC_WEB_URL`（本地 `http://localhost:8071`）。前端只能读取 `EXPO_PUBLIC_*`，通过一个集中式 `src/infrastructure/config/env.ts` 用 Zod 校验后导出，禁止在业务代码中直接读 `process.env`。Web dev server 固定端口 **8071**（`npm run web` 已带 `--port 8071`），OAuth 回调、邮件验证与找回链接的 Web redirect URL 均以 `EXPO_PUBLIC_WEB_URL` 为准。
- 简单草稿可用 AsyncStorage；需要可靠消息 outbox 时优先评估 `expo-sqlite`。不要为 MVP 引入复杂离线同步框架。
- 图表使用 React Native 基础组件或 `react-native-svg` 实现少量 progress bar、sparkline、milestone timeline；除非有明确证据，不引入重型图表库。
- 列表优先使用 `FlatList`/虚拟化；不要用长 `ScrollView` 承载大消息列表。

## 4. 推荐目录边界

基于 Expo 57 的 `src/app/` 路由事实，规划类似以下结构，并说明每层依赖规则：

```text
src/
  app/                       # Expo Router，只有 route/layout/redirect 装配
    (public)/
    (auth)/
    (internal)/
      (tabs)/
      applications/
      contacts/
      learning-relations/
      messages/
      settings/
  application/               # providers、角色路由、跨域 use cases、view models
  domains/
    identity/
    profiles/
    matching/
    connections/
    learning/
    messaging/
    proof/
    moderation/
  infrastructure/
    appwrite/
    api/
    auth/
    realtime/
    storage/
    analytics/
    notifications/
  shared/
    ui/
    layout/
    business/
    hooks/
    lib/
    types/
  state/                     # QueryClient、hydration 等基础设施装配
  styles/
    tokens/
    theme/
    typography/
global.css                   # NativeWind 入口样式
tailwind.config.ts           # 由 src/styles/tokens 驱动的 theme 扩展
contracts/                   # 纯 TypeScript DTO/schema；不得依赖 RN 或 Node runtime
backend/                     # 后端独立边界，不允许前端 import server-only 模块
```

依赖方向：

```text
src/app → application → domains → infrastructure
src/app → domain screens
application/domains → shared
infrastructure 不得依赖 route/screen
shared/ui 不得依赖业务 domain
contracts 不得依赖 React Native、Hono 或 node-appwrite
```

说明是否使用 npm workspaces。如果共享 contracts 会给 Metro 带来不必要复杂度，可采用单一纯 TS 根目录 + 契约生成/漂移检查，但禁止前后端手工维护两份无校验 DTO。

## 5. 路由与角色模型

计划必须定义：

- Public/Auth/Internal 路由分组。
- Auth gate、email verification gate、age/privacy gate、onboarding gate、role gate。
- 一个账号可拥有 `student`、`teacher` 或两者；`activeRole` 是 UI 投影选择，不是唯一权限来源。
- 服务端返回 `availableRoles` 与 `activeRole`；前端不可仅凭本地 Zustand 决定权限。
- Student/Teacher 使用共享 tab route，入口组件根据 active role 投影不同页面，避免复制两套路由。
- 共享 `tab-meta.ts` 同时驱动 mobile bottom tabs 与 Web sidebar。
- Deep link/OAuth return/password recovery 路由及 Web/native 差异；OAuth return 路由必须能区分 Google 与 Notion 提供商，并处理成功、用户取消、提供商错误、邮箱已存在需绑定四类结果。
- 404、无权限、账号删除、被封禁和过期会话的恢复路径。

## 6. Appwrite 混合 BFF 客户端设计

按以下边界规划并给出时序图：

1. 客户端直接使用 Appwrite Account 完成 email/password 登录/注册、email verification、OAuth、recovery 和 session restore。
   - 认证方式已冻结为三种：普通 email/password、Google OAuth、Notion OAuth；均通过 Appwrite 内置 OAuth2 provider 实现，前端不自行持有任何 client secret。
   - 规划前先查 Appwrite 当前版本对 Google 与 Notion provider 的支持与回调 URL 要求，以及 Web（`createOAuth2Session` 重定向）与 native（`createOAuth2Token` + `expo-web-browser` / `expo-linking` 深链回调）的差异；native 侧 API 以 Expo SDK 57 精确文档为准。
   - 账号归并规则：同一邮箱只能对应一个账号。已存在 email/password 账号再用 Google/Notion 登录时，引导登录后在 Linked accounts 中绑定（Appwrite identities），不得静默创建第二个账号；已绑定的身份可解绑，但至少保留一种登录方式，若仅剩 OAuth 身份需先设置密码。
   - Notion 只请求身份所需最小 scope，不读取工作区内容；Google 只请求 `openid email profile`。
   - 需定义 `AuthProvider = 'email' | 'google' | 'notion'`、`LinkedIdentity` 类型，以及 OAuth 回调状态机（`idle / redirecting / exchanging / linked / cancelled / failed`）。
2. 业务 API 不从客户端直接写 TablesDB。客户端从 Appwrite Account 创建短期 JWT，以 `Authorization: Bearer` 调用 Hono BFF。
3. JWT 只存在内存；提前刷新；收到 401 时只允许一次 refresh-and-retry，第二次失败清理用户作用域缓存并进入重新登录。
4. API client 支持：超时、AbortSignal、稳定错误码、request ID、游标分页、幂等键、网络错误与 rate limit 映射。
5. Realtime 仅用于低延迟提示，服务端增量查询是正确性兜底。断线重连后必须按 cursor/sequence 补齐。
6. Appwrite Realtime 订阅由登录态和当前学习关系决定；切换账号/角色时取消旧订阅。
7. 前端绝不能包含 `APPWRITE_API_KEY`、服务端 Function secret 或 admin client。

请定义 `AuthState`、`ApiError`、`Page<T>`、`RequestContext`、`RealtimeEvent` 和 session bootstrap 的类型/状态机。

## 7. 领域模型与前端投影

至少规划以下纯 TypeScript 模型及其 view model，不允许页面临时发明业务状态：

- `UserProfile`、`RoleMembership`、`TeacherProfile`、`StudentProfile`。
- `LearningRequest` / `TeacherInvitation`。
- `LearningRelation`。
- `LearningGoal`、`LearningTask`、`EvidenceItem`、`Feedback`、`ProofRecord`。
- `ConnectionRequest`、`Contact`、`BlockRecord`。
- `Conversation`、`ConversationMember`、`LearningMessage` discriminated union。

`LearningMessage` 至少预留：

- `text`
- `goal_created`
- `task_assigned`
- `evidence_submitted`
- `feedback_added`
- `milestone_reached`
- `system`

每一种结构化消息卡都应有稳定 payload、可访问文本、来源实体 ID 和可执行 action。不要把业务语义塞进自由文本或不可验证 JSON。

## 8. Server state、client state 与离线恢复

规划 Query Key 工厂、缓存边界、失效矩阵和 optimistic update 原则：

- 列表和详情必须有一致的 cache update 规则。
- 业务写请求带 `idempotencyKey`；消息另带 `clientMessageId`。
- 只对可安全回滚的操作 optimistic update。
- 文本消息支持 `queued / sending / sent / failed`；网络恢复后复用原幂等键重试。
- 会话保存 `lastSyncSequence`，Realtime 丢失后增量拉取。
- 草稿和 outbox 按账号隔离；登出时清理或安全封存，禁止串号。
- 首屏可先显示安全缓存，但必须标识 stale/offline。
- 不要求 MVP 全量离线编辑所有领域。

## 9. UI 组件化与极简图表

输出组件分层和命名清单：

- `shared/ui`：Button、TextField、Card、Avatar、Badge、Dialog、Sheet、Skeleton、EmptyState、ErrorState、OfflineBanner。
- `shared/layout`：Screen、PageContainer、ResponsiveShell、SplitView、FormLayout、Section。
- domain components：LearningRelationCard、GoalCard、TaskCard、EvidenceCard、TypedMessageCard、ApplicationCard、ConnectionRequestRow。
- 只在跨两个以上领域真实复用后，才提升到 `shared/business`。

图表限制：只做可解释的 progress bar、sparkline、small bar、milestone timeline；每个图必须有文本等价物和来源链接。不得实现复杂 node graph、雷达图或综合分仪表盘。

避免超大 Screen：请为页面容器、section、hook、view model 与 mutation 拆分制定软限制和评审规则。例如 Screen 只负责编排；数据转换放 mapper/view model；单个组件出现多领域数据拼装时提升到 application 层。

## 10. 英文、i18n、可访问性和响应式

- 所有用户可见字符串通过 i18n key 输出；第一批只提供 `en` locale，也要支持未来 locale 包。
- 使用 `Intl` 处理时间、日期和数字；存储 UTC，不硬编码时区。
- 英文文案短、明确、无地域化俚语。
- WCAG 2.2 AA；支持 Dynamic Type、screen reader、键盘、focus、reduced motion、高对比度。
- 触控目标至少 44×44；只用颜色表达状态是不合格的。
- 规划 phone / tablet / desktop 三档；桌面可以 side navigation 与消息双栏，但不得复制业务状态。
- 明确平台能力 adapter：文件选择、相机、分享、通知、深链和下载，不得在 domain screen 到处散落 `Platform.OS`。

## 11. 隐私与安全

- 默认不采集真实姓名、身份证件、人脸、精确生日和地址。
- analytics 不采集消息正文、证据正文、搜索原文或敏感未成年人信息。
- 精确 handle 搜索，避免学生账号被批量枚举。
- block/report 后立即更新本地权限投影并清理相关 Realtime 订阅。
- 日志不得包含 JWT、OAuth secret、email 全文、消息正文或上传签名 URL。
- Web 会话考虑 XSS、回调 URL allowlist 和公开环境变量边界。
- 图片/文件上传限制 MIME、大小和用途；先获得服务端授权再上传。

## 12. 测试与质量门禁

规划并给出具体命令：

- TypeScript strict typecheck。
- Expo lint、Expo Doctor、依赖兼容检查。
- Domain mapper、状态机、query key、幂等/outbox 的单元测试。
- React Native Testing Library 的关键页面/组件测试。
- Auth（email/password 注册登录、Google OAuth、Notion OAuth、OAuth 取消/失败、同邮箱账号绑定与解绑）、role switch、application → relation、message retry、evidence submit 的集成测试。
- Web 关键流 Playwright；移动关键流可在后续用 Maestro/Detox，必须说明取舍。
- iOS/Android/Web smoke matrix。
- 无障碍检查、低网速/断网恢复、深链和 session expiry 测试。
- `npx expo export --platform web` 或目标项目实际等价构建验证。

遵守 `E:\node-learn-en\AGENTS.md`：结束前至少执行 lint 与 `npx tsc --noEmit`；任何 Expo API 先查 SDK 57 精确文档。

## 13. 输出格式

请输出一份可直接拆票执行的 Markdown 规划，至少包含：

1. 基线审计与 ADR 列表。
2. 目标架构图、依赖方向和目录树。
3. 依赖清单：必需 / 可选 / 暂缓，并说明为何引入。
4. 路由树、角色 gate 和导航 metadata。
5. 领域类型与 view model 清单。
6. Appwrite Auth、BFF API client、Realtime 与 session 时序图。
7. Query keys、缓存失效、mutation、offline/outbox 方案。
8. 页面—组件—数据依赖矩阵。
9. 设计系统、i18n、响应式与无障碍方案。
10. 隐私与前端安全方案。
11. Phase 0、MVP、P1 的任务清单；每项包含依赖、产出、风险、验证命令和 Definition of Done。
12. 测试金字塔与跨端验收矩阵。
13. 明确 Non-goals、技术债上限和删除模板代码的计划。
14. 需要与后端共同冻结的 API/事件/权限契约列表。
15. 未决问题；不得用假数据或“后续处理”掩盖关键契约缺口。

## 14. 质量要求

- 计划必须基于实际目标仓库，不把旧项目 Expo 54 代码原样搬入 Expo 57。
- 样式统一使用 NativeWind 语义 class 与 design tokens；不得混用大面积手写 StyleSheet 形成两套样式体系。
- 认证只实现 email/password、Google、Notion 三种方式，不为其他 OAuth 提供商预埋 UI。
- 极简指功能与交互聚焦，不等于牺牲错误处理、权限、无障碍或弱网恢复。
- 先建立纵向闭环，不先铺满几十个页面。
- 不使用客户端直写业务 TablesDB 来换取短期速度。
- 不为轻量图表引入重型可视化体系。
- 不为“社交感”加入 Feed、粉丝、推荐好友或在线状态堆砌。
- 每个阶段都必须可运行、可演示、可测试、可回退。
