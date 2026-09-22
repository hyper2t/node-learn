# 前端产品设计规划提示词

> 将以下整段提示词交给产品设计/UX 规划 Agent。目标是先形成可评审、可开发、可验收的英文跨端 MVP 产品方案，不直接编写业务代码。

---

你是一名兼具教育产品、学习科学、跨端 UX、信息架构、隐私安全与设计系统经验的资深产品设计负责人。请基于真实仓库证据，为“知节点”的全球英语版 `KnowNode` 制定前端产品设计规划。

## 1. 必须先完成的仓库分析

在提出方案前，先读取并总结以下真实内容，不得只凭本提示词或产品名猜测：

### 现有知节点项目：`E:\zhijiedian`

优先阅读：

- `docs/zhijiedian-philosophy-and-engineering-constraints.md`
- `docs/zhijiedian-mvp-frontend-architecture.md`
- `docs/student-teacher-web-implementation-plan.md`
- `docs/student-learning-achievement-graph-implementation.md`
- `docs/im-chat-system-prd.md`
- `docs/teacher-interest-hook-relation-funnel.md`
- `docs/student-my-tab-and-profile-implementation-spec.md`
- `docs/student-learning-teacher-growth-tab-refactor-spec.md`
- `app/**`、`src/application/**`、`src/domains/**`

核对学生端、老师端、角色切换、学习关系、匹配/申请、消息协作、学习任务、证据/证明、个人主页和响应式 Web 的当前形态。指出哪些理念应保留、哪些中国本地化能力必须移除、哪些现有功能对海外 MVP 过重。

### 技术参考项目：`E:\proto-store`

阅读 `package.json`、`src/app/**`、`src/components/**`、`src/features/**`，理解其 Expo 57 跨端结构和极简组件体系，但不要照搬电商产品的信息架构。

### 目标项目：`E:\node-learn-en`

读取 `AGENTS.md`、`package.json`、`app.json`、`src/app/**` 和现有组件。明确这是 Expo SDK 57 / React Native 0.86 / React 19.2 / Expo Router 57 的新项目，路由位于 `src/app/`。

在计划开头列出“事实、推断、待确认”三栏，避免把推断写成事实。

## 2. 产品第一原则

所有产品决策必须服从以下理念，而不是退化为课程商城、短视频内容流、普通聊天工具或 AI 问答产品：

1. **Nodes before courses**：知识节点是第一性对象，课程只是节点之间的暂态学习路径。
2. **Learning is structural change**：学习评价关注理解结构、关系质量、解释能力、推理稳定性与迁移，而不是时长、打卡次数和播放量。
3. **Capability through evidence**：能力来自项目、任务、可追踪贡献、反馈和证据，不来自不可验证的标签或证书堆砌。
4. **LearningRelation is the core**：师生匹配、目标、任务、消息、反馈、进度和证明都围绕一条持续演化的 `LearningRelation` 组织。
5. **Messages are collaboration events**：消息不仅是文本，还可以是目标、任务、提交、反馈、里程碑和证据事件。
6. **Trust accumulates over time**：信任来自长期一致性与可验证贡献，不使用热度、粉丝数、点赞刺激或黑箱推荐制造权威。
7. **UI is a projection of structure**：界面要让用户看见“目标—任务—证据—反馈—变化”的结构，而不是纯信息流。
8. **Anti-addiction**：禁止无限滚动、连续奖励、焦虑式红点、随机奖励和仅为停留时长服务的机制。
9. **AI assists, never declares truth**：如规划 AI，只能做结构建议、总结与解释，必须显示来源、置信边界并允许用户修正；MVP 默认不实现自治 AI。
10. **User-owned data**：必须规划导出、删除、可理解的权限与推荐理由，不做平台锁定。

## 3. 已冻结的业务与市场边界

- 产品 UI、系统文案、示例内容、邮件、推送和无障碍标签均使用自然、简洁、全球可理解的英文。
- 英语优先但必须 i18n-ready；不得把英文字符串散落在组件中。
- 首发按全球英语版规划，隐私和安全基线同时考虑美国与欧盟/英国。
- MVP 默认只服务满足地区数字同意年龄的用户；建议采用可配置的年龄段自证。默认方案可设为 `16+`，不收集精确生日；低于门槛时阻止注册，监护人同意能力列为后续独立项目并标记需要法律评审。
- 支持学生角色、老师角色，以及同一账号多角色切换。
- 不做实名认证、身份证、护照、人脸、OCR、教师执照强制校验或中国手机号体系。
- 认证方式已冻结为三种：**普通 email/password 登录/注册（含 email verification 与密码找回）**、**Google OAuth 登录/注册**、**Notion OAuth 登录/注册**。三种方式在 Sign in 与 Sign up 页面同时可见，视觉权重一致，不得把某一种藏进二级入口。Apple、GitHub 等其他 OAuth 提供商不进入 MVP；若 iOS 上架审核要求提供 Sign in with Apple，列入风险清单交产品负责人与法务/合规确认，不在本轮规划中默认加入。
- 同一邮箱通过不同方式登录时必须归并为同一账号：已用 email/password 注册的用户再用 Google/Notion 登录，应引导绑定而不是生成重复账号；反之亦然。用户可在设置中查看并解绑已关联的 Google/Notion 身份，但至少保留一种可用登录方式（若只剩 OAuth 身份，解绑前需先设置密码）。
- Notion 登录只用于身份认证，MVP 不读取用户 Notion 工作区页面或数据库内容；界面需明确告知只请求最小身份信息，避免用户误以为会同步笔记。
- 老师资料是自述信息；可信度来自已验证邮箱、作品/证据、学生反馈和持续贡献，界面不得暗示平台已完成执照背书。
- MVP 不做支付、订单、钱包、充值、退款、付费课程市场和订阅；只在架构中预留未来计划/权益边界。
- 不复制中国区运营活动、学习打卡增长、实名认证、短信验证码、地区选择器或 CNY 交易设计。

## 4. MVP 核心闭环

产品必须优先跑通以下最小闭环：

```text
Join → Choose role → Describe a learning goal
→ Find/invite a suitable teacher or accept a teacher invitation
→ Send/review a learning request
→ Establish a LearningRelation
→ Agree on goals and next tasks
→ Collaborate through structured messages
→ Submit evidence and receive feedback
→ Record a simple, explainable learning change/proof
```

老师端闭环：

```text
Join as teacher → Build a concise teaching profile
→ Receive a relevant request/invite a learner
→ Review context and accept/decline
→ Establish a LearningRelation
→ Set goals/tasks and give feedback
→ Review evidence
→ Observe a concise student progress summary
```

不要让“浏览内容”成为核心闭环；核心动作是建立和推进高质量学习关系。

## 5. 极简功能边界

### 5.1 学习图谱与图表

图谱是领域模型，不等于必须展示复杂力导向图。MVP 只允许以下轻量表达：

- 当前目标、关联技能/知识节点和下一步任务的分组列表。
- 3–5 个里程碑的时间线。
- 少量趋势：任务完成、证据增加、反馈后修订次数等；使用进度条、sparkline 或小型条形图。
- 学生端展示“Current focus / Evidence / Recent change / Next step”。
- 老师端展示“Active students / Needs attention / Recent evidence / Next reviews”。
- 每个指标必须能解释来源，并可进入对应证据；不得展示神秘综合分。

明确排除：全屏关系图、3D 图谱、复杂图例、十几种指标、不可解释雷达图、排行榜和大屏驾驶舱。除非用户研究证明必要，否则不引入重型图表库。

### 5.2 联系人/交友申请

该能力只服务学习协作，不建设泛社交网络。MVP 限定为：

- 通过精确 handle、邀请链接或已发生学习申请的上下文找到用户。
- 发出一条带简短说明的 connection request。
- 接受、拒绝、撤回、屏蔽、举报。
- 只有双方建立联系或共享学习关系后才能私信。
- 老师申请、老师邀请和同学联系人申请在概念与 UI 上明确区分。
- 显示请求来源与发起原因，减少陌生骚扰。

明确排除：通讯录批量上传、附近的人、可能认识的人、粉丝/关注数、好友排行榜、动态 Feed、公开在线状态、复杂分组、关系链推荐和病毒式邀请奖励。

## 6. 建议的信息架构起点

规划时验证并优化以下四入口模型，主导航不得超过四个可见入口：

### Student

1. `Home`：当前学习关系摘要、下一步、待处理申请、最近反馈。
2. `Messages`：会话与结构化协作事件。
3. `Learning`：关系工作区、目标、任务、证据、轻量进展。
4. `Profile`：公开资料、能力证据、隐私、账号与角色切换。

### Teacher

1. `Workbench`：待处理申请、今日评审、需关注学生、快捷动作。
2. `Messages`：与学生/协作者的会话。
3. `Students`：活跃学习关系、学生详情与跟进。
4. `Profile`：教学资料、方法、可展示证据、设置与角色切换。

移动端使用底部导航；桌面 Web 在合适断点使用左侧导航，但导航元数据必须共享，不能形成两套产品。匹配/发现老师、申请中心、联系人、设置、证据详情等作为二级页面或 modal/sheet。

## 7. 必须设计的页面与状态

请根据 MVP 闭环输出页面清单，并至少覆盖：

- Welcome / Sign in / Sign up（email/password、Continue with Google、Continue with Notion 三种入口）/ OAuth return（成功、用户取消、提供商错误、邮箱已存在需绑定）/ Verify email / Recovery / Linked accounts（查看、绑定、解绑 Google 与 Notion）。
- Age and privacy gate、role onboarding、student goal onboarding、teacher profile onboarding。
- Student Home、Teacher Workbench。
- Teacher discovery/search、teacher profile、learning request create/review。
- Student applications、teacher applications/invitations。
- LearningRelation workspace、goal detail、task detail、evidence submit/review、proof detail。
- Messages list、conversation、typed message cards、offline/sending/failed states。
- Contacts、request inbox、send request、block/report。
- Student profile、teacher profile、edit profile、privacy visibility、data export/delete、role switch。
- Empty、loading skeleton、offline、partial data、permission denied、deleted content、blocked user、rate limited、expired session、error recovery。

每个页面必须描述：目标、主要用户、进入条件、信息层级、主动作、次动作、关键组件、数据依赖、权限、空状态、错误状态、移动/桌面差异和验收标准。

## 8. 视觉与交互方向

整体风格：安静、可信、清晰、留白充足、低刺激的极简风格。

- 样式实现层已冻结为 **NativeWind（Tailwind CSS for React Native）**：设计产出必须以 design tokens 的形式表达（颜色、间距、圆角、字号/行高、断点、语义状态色），并能一一映射到 `tailwind.config` 的 theme 扩展；不要输出只能用手写 StyleSheet 表达的特例样式。
- 使用单一中性色阶与克制的品牌强调色；角色可以有轻微语义差异，但不能像两款不同产品。
- 卡片数量要少；同屏只突出一个首要动作。
- 以排版、分组、间距和语义状态表达结构，不用装饰性玻璃、渐变、阴影或复杂动效堆砌高级感。
- 动效只能表达建立关系、状态迁移、提交完成、分叉/修订等变化；尊重 reduced motion。
- 触控目标至少 44×44；支持 Dynamic Type、键盘导航、可见焦点、屏幕阅读器和色彩对比。
- 以 WCAG 2.2 AA 为设计验收底线。
- 英文文案采用短句、主动语态、非评判性表达；避免 “failure”“weak student”等标签化词语。
- 时间与日期按用户 locale/time zone 展示，服务端统一保存 UTC。

## 9. 安全、隐私与信任体验

规划必须包含：

- 最少数据原则、公开/仅联系人/仅学习关系/私密四类可见性。
- 精确搜索优先，默认不允许广泛枚举学生账号。
- 联系请求频率限制、撤回、屏蔽、举报和申诉入口。
- 未成年用户默认更严格可见性与陌生消息限制。
- 老师自述信息与平台验证状态必须分开展示，禁止虚假认证感。
- 数据导出、账号删除、会话退出、Google/Notion 第三方登录绑定与解绑的可理解流程。
- 解释推荐原因；允许隐藏推荐、调整目标和关闭个性化。
- 事件分析不采集消息正文、证据正文或未成年人敏感内容。

这不是法律意见；需要法律确认的内容请在风险清单中单独标记，不要伪装为已合规。

## 10. 输出格式

请输出一份结构完整的 Markdown 产品设计规划，至少包含：

1. Executive summary。
2. 仓库现状证据：事实 / 推断 / 待确认。
3. 产品北极星、设计原则与反目标。
4. 用户角色、JTBD、痛点与信任边界。
5. MVP / P1 / Later 功能矩阵，以及明确的 Non-goals。
6. 学生端和老师端的核心用户旅程图。
7. 信息架构、站点地图和双角色导航表。
8. 页面级规格与状态矩阵。
9. LearningRelation、结构化消息、证据/证明的产品语义。
10. 极简图谱/图表策略。
11. 极简联系人/申请策略。
12. Design tokens、组件清单、内容设计与英文文案示例。
13. Mobile / tablet / Web 响应式策略。
14. Accessibility、隐私、安全、未成年人保护与内容治理。
15. 隐私友好的产品指标；不得把停留时长、连续登录或消息数量作为北极星。
16. 可执行的设计阶段、依赖、评审门和每阶段 Definition of Done。
17. 逐页面验收标准。
18. 风险、待法律评审项和仍需产品负责人决定的问题。

## 11. 质量要求

- 不要输出空泛愿景，必须落到真实页面、状态、用户动作和验收标准。
- 不要把现有中国版所有功能翻译成英文；要主动做减法。
- 不要把 Appwrite、React Native 等技术名词当作产品价值。
- 不要以复杂图表、社交 Feed、AI 噱头或认证徽章掩盖学习关系本身。
- 任何新功能都要回答：它是否帮助建立、推进或验证一条学习关系？如果不能，默认不进入 MVP。
- 计划必须能够直接交给前端和后端规划 Agent 拆分实施。
