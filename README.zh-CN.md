# 校车智能调度平台与移动车队全栈套件 (School Bus Dispatch Platform & Fleet Suite)

<p align="center">
  <strong><a href="README.md">English</a></strong> |
  <strong><a href="README.fr.md">Français</a></strong> |
  <strong>简体中文</strong>
</p>

---

专为**中小型校车运营公司（Small-to-Medium School Bus Operators）**量身打造的现代化、全栈开源智能调度与实时车队管理系统。

### 🎯 适用规模与定位
- **日调度班次**：$< 2,000$ 趟次/天
- **员工/司机规模**：$< 1,000$ 人
- **核心定位**：极简部署、超低运行成本、开箱即用的端到端校车运营数字化解决方案。

---

## 🌐 在线演示体验 (Live Demo)

系统提供全功能的在线 Demo 环境，无需本地安装即可直接体验调度中心、移动端及智能 AI 助理：

| 模块 | 在线体验地址 | 登录方式与操作说明 |
| :--- | :--- | :--- |
| **调度中心控制台 (`web`)** | [schoolbus.pcytech.ca](https://schoolbus.pcytech.ca/)<br>*(备用: [schoolbusdispatchapp.web.app](https://schoolbusdispatchapp.web.app/))* | 页面提供 **「1-Click Launch as Operations Admin」** 快捷按钮，点击即可直接以超级管理员身份免密进入控制中心体验全部调度、排班与合规管理功能。<br>*(注：访问 `/?mode=ai` 可直接以全屏独立 PWA 模式打开 AI 调度助手)* |
| **司机与跟车员端 (`driver_app`)** | [schoolbus.pcytech.ca/driver](https://schoolbus.pcytech.ca/driver)<br>*(备用: [schoolbusdispatchapp.web.app/driver](https://schoolbusdispatchapp.web.app/driver))* | 在登录界面点击下方的 **「Quick Demo Credentials」**（填充演示凭据）按钮即可自动填入演示账号（`driver1d` / `Dispatch2026!`），角色选择「Driver」或「Attendant」，点击 **Sign In** 即可进入排班看板、Pre-trip 检查与学生签到界面。 |
| **家长实时追踪端 (`parent_app`)** | [schoolbus.pcytech.ca/parent](https://schoolbus.pcytech.ca/parent)<br>*(备用: [schoolbusdispatchapp.web.app/parent](https://schoolbusdispatchapp.web.app/parent))* | 采用无密码安全验证码机制。在登录页面直接点击 **「Demo Phone」** 或 **「Demo Email」** 按钮自动填入，点击 **Continue** 后，在验证码输入页轻点黄色的 **「Dev Passcode (Tap to autofill)」** 即可自动填充验证码并登录，立即查看校车实时 GPS 地图轨迹与到站预计。 |
| **MCP 模型上下文协议端点** | `https://dispatch-api-kv7qum3dca-nn.a.run.app/api/mcp` | 标准 Anthropic MCP 协议服务端点，供 Claude Desktop、Cursor、Gemini 等外部 AI 客户端通过 MCP Token 接入直接对话调度系统。 |

---

## 📱 系统应用套件与主要功能列表

平台由一套深度协同的端到端应用矩阵组成，全面覆盖调度管理、一线司乘、学生家长及智能 AI 自动化运营：

### 1. 调度中心运营管理控制台 (`web`)
*基于 React + TypeScript + Tailwind CSS 构建的桌面与平板运营控制台，服务于调度员、车场主管、安全员与财务会计。*

- **交互式排班调度工作台**：早班 (AM)、午班 (MD)、晚班 (PM) 视觉看板，实时呈现班次状态（待指派、已排班、已签到、执行中、已完成）。
- **动态替班与应急调度**：一键指派替班司机（Cover Driver）与跟车员，支持提前为已审批的请假安排替岗，避免临期发车缺人。
- **车队档案与资产管理**：完整录入车辆信息（车型、荷载人数、轮椅位支持、VIN 车架号、里程数、燃油类型），全面追踪车辆在线状态。
- **政府法定 6 个月安全检查与 SAAQ / CVOR 合规预警**：自动倒计时提醒半年度及年度法定车检。逾期未检或存在严重故障（Defects）的车辆，系统将自动在调度排班列表中隐藏或拦截，杜绝带病上路。
- **司机与跟车员合规资质档案**：商业驾照类别（CDL A/B/C/E/F）、体检证明、无犯罪记录及到期时间预警，超期自动标识警示。
- **线路规划与学生名单管理**：结构化停靠站点顺序、电子地理围栏、计划到站时刻、乘车学生名单及特殊照护需求（医疗/行动便利）。
- **包车业务（Charter Operations）全流程闭环**：
  - **大型多车组协同调度**：单次大型包车（如 10 辆校车出游）支持自动拆解为多个独立 Shift 车组（司机 + 车辆 + 跟车员），司机端仅呈现专属任务，系统独立追踪各组 Check In/Out 与逐站停靠时刻。
  - **司乘人员智能搜索指派**：快速搜索司机与跟车员档案，支持根据驾照等级、出勤状态与空闲时段精准指派。
  - **一键发布招募（Charter Route Openings）**：支持将未排定人车的包车班次一键发布至 Route Openings，在 Web 与 Driver App 中按 Charter 专属分类展示，供司机/跟车员自选接单申请（Claim）。
  - **四站往返标准行程与自定义编排**：内置研学出游“早上去程接送 + 下午返程接送”标准四阶段（出发学校接人 08:00 → 目的地送达 08:30 → 下午返程接人 15:00 → 学校送达 15:30）日程表，支持可视化增删改站点与时刻，多端毫秒级实时同步。
  - **透明薪资费率与考勤闭环（Payroll Sync）**：为包车配置专属司机费率、跟车员费率与 EI 工时；司机端签到打卡后即刻向司乘人员透视披露核定报酬，并自动生成独立的 Charter Payroll 待审条目写入审计日志。
- **薪资核算、双周工资单（Bi-Weekly Payroll）与 QuickBooks 导出套件**：
  - 灵活配置学区基准费率（School Board Base Rates）、司乘人员小时费率与单趟固定费率，结合顶层全局内存与本地缓存实现秒级加载。
  - 班次完成后自动核算当日实发薪资、法定节假日路线班次补贴（Statutory Holiday Credits）及已批准费用报销（Approved Expenses），全量数据写入 `payroll_logs` 审计日志。
  - **司机双周工时与薪酬明细弹窗（Details）及 PDF 账单**：支持按司机查看两周总工资、EI 可保工时、第 1 周/第 2 周分周对比及每日每趟班次明细（路线、AM/PM、打卡时间、单次金额与工时），支持一键导出矢量 **A4 PDF 账单**、**CSV** 与官方模板 **Excel (`.xlsx`)**。
  - **QuickBooks 与加拿大主流薪酬软件导出**：内置 4 种专业财务对接格式，支持一键导出 **QuickBooks Online (QBO)** `TimeActivity` CSV、**QBO 双周汇总 CSV**、**QuickBooks Desktop Canada** 原生 `.IIF` (`TIMEACT`) 工时文件，以及 **Wagepoint / ADP / Ceridian Powerpay (Canada)** 标准批处理 CSV（含 CRA/ROE EI 工时与免税报销）。
- **零延迟全局常驻缓存与虚拟滚动列表**：对线路、员工、车辆、学生、学校、车场、薪资费率、校历及公司通讯录启用顶层全局常驻缓存与 IndexedDB/`localStorage` 持久化，配合 `@tanstack/react-virtual` 虚拟滚动技术流畅渲染千级数据列表。
- **空缺线路发布与司机竞价（Route Bidding）**：调度员可一键发布空缺线路或临时增援班次，在线查看司机提交的接单申请与资历，快速择优定岗。
- **安全隐患、车辆缺陷与违规事件闭环**：车辆机械故障（Defects）、道路隐患（Hazards）及学生乘车违规行为（Student Incidents）快速立案、上传现场照片并跟踪维保维修闭环。
- **BusPlanner 线路导入与同步**：支持从 BusPlanner 同步 Staging 线路与站点数据，可视化比对线路差异，支持一键将预排线路无缝更新至正式运行班次中。
- **外部数据系统联动**：集中配置与管理 BambooHR 员工人事同步、Zonar GPS 历史行驶轨迹与怠速停靠点地图回放。
- **精细化 RBAC 权限管理体系**：基于角色的严密权限隔离，灵活配置调度员、主管、安全员、财务会计等不同岗位的菜单与读写权限。
- **Model Context Protocol (MCP) Token 安全管理**：在后台安全生成并管理带有效期的 MCP 访问密钥（SHA-256 哈希加密存储），授权外部 AI Agent 接入。

---

### 2. 司机与跟车员移动工作台 (`driver_app`)
*基于 Flutter 构建的跨平台移动端与 PWA 应用，供一线校车司机与跟车监护员随身使用。*

- **每日排班日程总览**：实时展示司机当天的早、午、晚班次时间表、车号、线路名称及预计出车时刻。
- **双周工时表与薪酬明细（Bi-Weekly Timesheet）**：底部导航栏与首页快捷区内置 **Timesheet** 页面，与后台双周工资单实时同步，直观展示两周总工资、EI 总工时、净发总额（含报销与节假日补贴）、Week 1 / Week 2 对比，以及按天分组的每日 Dispatch Shift 明细（路线号、AM/PM 班次类型、单次薪资金额与单次工时）。
- **一键出勤打卡（Check-In / Check-Out）**：出车前及收车后一键签到/签退，状态毫秒级同步至调度中心大屏幕。
- **包车任务卡片与闭环（Assigned Charter Trips）**：专属包车任务卡片，展示包车详情、乘务角色、客户备注；卡片直观呈现四站标准行程时刻表（#1 早上接人、#2 早上送达、#3 下午接人、#4 下午送达）；提供一键 Check In / Check Out、站点到达/离开时间打卡，签到后即时显示确认的司机/跟车员费率（如 `$150.00 • 5.0h EI`），并自动关联出车前车检及薪资结算。
- **逐站导航与到站时刻表**：按顺序展示全线停靠站点、计划到达时间、乘降学生数，集成路线地图指引。
- **学生乘降考勤打卡**：到站支持通过手动轻点或手机摄像头/条码扫码，即时完成学生上车、下车考勤标记，突出显示请假状态与特殊医护提醒。
- **Schedule 5 出车前安全检查（Pre-Trip Inspection）**：符合法规（MTO / SAAQ / CVOR）标准的车辆出车前数字点检清单，包含里程表录入、灯光、刹车、应急逃生门检查及隐患上报确认，未通过无法出车。
- **车辆缺陷与安全隐患实时报修**：随时上报车辆机械缺陷（刹车异响、车灯故障等）或道路突发险情，支持文字描述与拍照上传，调度中心第一时间接收报警。
- **空缺线路接单竞价（Route Bidding）**：司机可在移动端浏览调度发布的公开空缺线路与包车增援班次，查看薪资待遇并一键提交接单意向。
- **车队即时通讯（Fleet Real-Time Chat）**：与调度中心建立双向即时文字消息沟通，快速同步堵车、晚点或紧急突发情况。
- **智能推送通知（FCM Push Notifications）**：出车前定时任务倒计时提醒、车检督促通知以及调度中心临时发来的换车换线通知。

---

### 3. 家长校车实时追踪端 (`parent_app`)
*基于 Flutter 构建的移动优先应用，采用 Gentler Streak Family Bento 治愈系深色设计，专为学生家长与监护人打造。*

- **免密码短信/邮箱安全验证码登录**：只需输入手机号或邮箱，通过 6 位动态验证码（OTP）即可一键安全免密登录，内置 Demo 凭证一键填入。
- **方案 C（Gentler Streak Family Bento）设计系统**：黑曜石底色（`#0B101D`）、校车暖黄（`#FACC15`）与薄荷绿（`#34D399`），信息卡片紧凑克制，释放 74% 以上屏幕区域保障全屏地图沉浸感。
- **三标签页清晰导航体系**：
  - **🏠 Bento（实时追踪）**：全屏动态地图结合平滑折线贴路吸附，提供秒级进站倒计时卡片（`< 2 MINS AWAY`）、微步进进度条、一键呼叫当班司机与极速请假快捷键。
  - **📅 Schedule（班次时刻）**：学校 Master 路线周计划与每日实际调度对比视图（如周一至周四 15:00 正常放学 vs 周五 13:00 提早放学），逐站时刻表与实时运营调整标注一目了然。
  - **📞 Support（调度客服中心）**：调度服务台标签页，支持与调度员双向实时在线沟通、24/7 短信热线指令指南模态框、一键应急呼叫及多子女快速切换。
- **纯家长视角的极简信息架构**：彻底去除内部运营线路代码（如 `OCDSB-001`），专注展示校车编号（如 `Bus #42`）、司机姓名及站点到站时间，杜绝信息过载与文字截断。
- **学生请假快速上报**：家长可直接在应用内为孩子报备早班或午班缺勤，调度中心及当班司机手机端即刻同步，免去司机空等。
- **多子女家庭一键切换**：多孩家庭可在同一应用内无缝切换查看不同孩子的上下学班次与接送状态。
- **乘车状态实时指示**：清晰的生命周期状态徽标（`SCHEDULED` 计划中、`EN_ROUTE` 运行中、`APPROACHING` 即将到站、`BOARDED` 已上车、`DROPPED_OFF` 已送达、`ABSENT` 请假缺席）。
- **个性化到站通知提醒**：可自由配置车辆即将进站提醒（如提前 5 分钟）、安全上车通知及安全到校/到家送达通知（支持短信、邮件与 Push 推送）。

---

### 4. AI 智能调度助手与 MCP 开放协议
*支持语音交互的智能化运营助理与开放 Agent 协议接入层。*

- **对讲机式语音交互**：支持 Web Speech 实时语音听写识别与高品质神经网络语音朗读（TTS），调度员动动嘴即可完成高频操作。
- **双引擎协同架构**：
  - *零成本本地语义引擎*：0 令牌消耗；毫秒级正则与 Firestore 本地查询，极速响应排班查询、缺人路线、车辆状态及薪资总览。
  - *生成式 Gemini 大模型引擎*：在处理复杂调度逻辑、长文本排班建议及全局统计分析时自动无缝接管。
- **动态交互式操作卡片（ActionCards）**：对话直接输出可点击操作的卡片组件，支持在对话流中一键确认换人换车、查看事故详情及查阅薪资明细。
- **标准 Anthropic Model Context Protocol (MCP)**：提供标准 `/api/mcp` 端点与本地 stdio 服务，允许 Claude Desktop、Cursor、Gemini CLI 等外部 Agent 安全读取调度班次、核验人员合规资质并执行排班指令。

---

### 5. 高性能 Go 后端微服务 (`server`)
*运行于 Google Cloud Run 上的企业级 Go 微服务，兼具毫秒级响应速度与无服务器弹性伸缩能力。*

- **Clean 架构与 CQRS 设计**：基于 Go 1.24+ 与 Chi 路由构建高并发 REST API，针对高频移动端遥测及 WebSocket 流式监听深度优化。
- **免登录邮箱审批工作流**：深度集成 Twilio SendGrid / Amazon SES 邮件 Webhook，员工发邮件即可请假，主管在工作邮箱内点击签名链接 1 秒完成审批。
- **Twilio 短信网关**：稳定下发家长登录验证码短信及紧急交通突发告警。
- **多源数据整合管道**：后台自动对接 BambooHR 员工花名册、Zonar GPS 车辆轨迹与怠速分析、BusPlanner 站点排班排线。
- **Google BigQuery 冷热数据归档**：定时将已完成的历史班次、考勤打卡日志与薪资记录归档至 BigQuery，保障数据合规留存、长期审计与海量数据低成本分析。

---

## 🌟 核心优势与关键特性

### 1. 极低运行成本（Serverless 云原生）
- 基于 **Firebase + Google Cloud Run** 架构构建，完全按需计费（Pay-as-you-go）。
- 在非运营高峰期自动缩容至零，中小型车队日常运营的基础设施云服务开销极低。

### 2. 全生命周期闭环运营覆盖
- **每日调度台**：早班、午班、晚班排班排线，实时监控出勤与运行状态。
- **线路与学生管理**：停靠站点、上下车名单、家庭地址与学校对应关系。
- **员工与车辆档案**：驾驶员 CDL 商业驾照资质预警、车辆档案与状态。
- **薪资费率与日常 Payroll**：自定义小时费率、单趟费率，出勤确认后直接输出精准财务工时与对账。
- **安全与运营事件闭环**：第一时间收集并处理车辆故障（Defects）、道路隐患（Hazards）及学生行为违规事件（Student Incidents）。

### 3. 全局实时数据流（Real-time Everywhere）
- 全系统所有关键页面均深度集成实时数据推送（Firebase Firestore onSnapshot / WebSockets）。
- 包括车站车辆进出、学生上下车打卡、紧急请假、调度排班看板、事故事件上报，**无需手动刷新页面，全员毫秒级状态同步**。

### 4. 零登录邮箱自动化审批工作流（Frictionless Email Actions）
- **员工免登录请假**：司机或跟车员无需登录 App 或 Web 终端，直接使用系统认证的个人/工作邮箱发送请假邮件即可自动发起申请。
- **HR 邮件内一键直批**：HR/主管无需登录后台，在公司邮箱收到的通知邮件中直接点击「Approve」或「Reject」安全链接，即可完成秒级审批。

### 5. 智能推送通知（Firebase Cloud Messaging）
- 自动向司机端 App 推送定时任务提醒：出车前提醒、签到打卡（Check-in）提醒、出车前车检（Pre-trip Inspection）督促，确保合规运营。

### 6. 提前替班与替岗智能调度
- 当员工提前请假获批后，调度员可在排班工作台中提前预约指派替班司机（Cover/Substitute Drivers），消除运营盲区与临期缺勤风险。

### 7. 完善的车辆全生命周期与维保管理
- **政府法定 6 个月安全检查**：强效跟踪年检与半年检到期日，超期自动预警。
- **日常维保联动**：日常机油更换、刹车轮胎磨损、故障报修闭环跟踪，维护中的车辆自动从可用排班列表中联动下架。

### 8. 内置运营实时通讯（Real-time Chat）
- 调度中心与车场运营、车队司机之间内置安全可靠的实时即时通信通道，保障突发路况与运营变更即时触达。

### 9. 双引擎 AI 智能调度助手与全功能语音交互 (Dual-Engine AI Copilot & Voice I/O)
- **双引擎智能架构**：
  - **零令牌内置语义引擎 (Zero-Cost Built-in Engine)**：无需消耗 LLM API Token，对车队排班总览、缺司机班次、车辆档案、学生安全违规记录、人事档案、请假与报销等高频操作提供毫秒级、0 成本精准响应。
  - **生成式 Gemini 大模型引擎**：在用户配置 API Key 且进行复杂运营逻辑咨询或长文本推理时无缝调用，具备按用户额度限制与防止透支的配额管控体系。
- **可交互结构化操作卡片 (ActionCards)**：AI 不仅返回文字，还会在对话中动态渲染可点击交互的数据卡片（派班总览、确认指派、车辆档案、学生事故报告、薪资费率与报销卡片）。
- **多语言语音双向交互 (Voice I/O)**：
  - 支持基于 Web Speech API 的实时语音听写输入（普通话、英语、法语）。
  - 支持高品质自动朗读播放（TTS 语音播报回复），方便调度员在忙碌时免打字操作。
- **移动端轻量独立 PWA 模式**：
  - 支持通过浏览器直接安装为桌面/手机 App；
  - 访问 `/?mode=ai` 可直接进入全屏纯净版 AI 助手，在手机上如同随身对讲助理般随时随地语音调度。

### 10. Model Context Protocol (MCP) 模型上下文协议集成
- **原生支持 Anthropic MCP 标准**：内置标准化 MCP Server（支持本地 Stdio 独立可执行程序 `cmd/mcp` 以及标准 HTTP MCP 端点 `/api/mcp`）。
- **外部 AI Agent 无缝接入**：外部 AI 工具（如 Claude Desktop、Cursor、Gemini CLI 或自主 Agent）可通过 MCP 协议直接与校车调度系统握手，执行安全读取班次、查询空缺路线、核查车辆驾照合规性及下发调度指令。
- **安全隔离与 Token 鉴权**：在系统的 **系统设置 (Settings)** 页面支持自主生成带有效期的专用 MCP Token，采用 SHA-256 哈希安全存储，严格遵循当前操作员的 RBAC 角色权限。

### 11. 极简差量 RBAC 架构与零额外开销行级安全 (Row-Level Security)
- **彻底极简 Token 声明架构（Role + Overrides 差量）**：覆盖 12 个角色跨 34 个功能模块。严格遵守 Firebase Auth 1000 字节自定义声明上限，Token Claims 仅存储员工基础 `role` 及与默认基准存在差异的 `ovr` 差量配置（体积通常 < 50 字节），杜绝多次数据库回查。
- **生产级行级安全规则 (`firestore.rules`)**：依托内存零计费匹配，实现严密的数据所有权校验：
  - **业务表单行级隔离**：司机与跟车员仅能读取与提交属于本人创建的请假单、车辆故障报修、学生违纪事件、道路隐患报告、钥匙领用及费用报销，严禁跨人查看与全表拉取。
  - **派工与路线范围受限**：一线司乘仅能获取指派给自身工号的路线、站点乘车学生及当日派工班次（`myEmployeeId in assignedEmployeeIds`）。
  - **财务与密钥集合隔离**：工时审批表 (`dispatch_payrolls`) 仅允许调度员审批、财务专员只读；所有系统密钥、集成临时暂存集合对任何前端客户端完全拒绝访问。

### 12. BigQuery 冷热数据归档与灾备
- 运行期活跃数据存放于 Firestore 保证高性能与毫秒级推送；
- 历史调度记录、出勤日志与审批数据自动归档至 Google BigQuery，既兼顾了日常数据库的高效率与低开销，又满足合规审计、商业分析与数据防丢要求。

### 13. BusPlanner Staging 线路
- **Staging Routes** 只读展示从 BusPlanner 拉下来的班次、站点和学生。这个页面不安排司机、车辆或跟车员。
- 有写权限的调度员可以把一条 staging 线路复制到当前线路。已经安排好的人员保持不变。
- 只有打开 BusPlanner 同步之后，才会按生效日自动复制。每个班次在生效日前一个工作日的美东时间上午 9:00 写入。若前一天是周末，则提前到周五上午 9:00。旧班次周末仍按原计划运行，并在生效日的前一个日历日停用。
- 同步关闭时，演示模式会在每周一上午 9:00 重建 5 条示例 staging 线路。这些示例不会自动复制到正式线路。BusPlanner 默认地址是 `https://school.mybusplanner.ca`。

### 14. 外部数据同步与 Zonar 车辆轨迹
- **External Data Sync** 集中管理 BambooHR、Zonar 和 BusPlanner。密码和 API 密钥只留在服务器上，不会返回给浏览器。
- BambooHR 同步只读取员工资料。Zonar 的 GPS 轮询和线路回写是两个独立开关。线路数据先在本地预备，只有打开线路同步后才会发给 Zonar。
- 调度站点地图可以在 Zonar 同步已开启时，画出该车当天的行驶轨迹和怠速停留点。

---

## 核心架构与技术栈

| 模块 | 技术选型 | 说明 |
| :--- | :--- | :--- |
| **司机端应用 (`driver_app`)** | **Flutter (Android / iOS / Web)** | 排班查看、出车签到、Pre-trip 检查、学生上下车扫码、实时调度提醒 |
| **家长端应用 (`parent_app`)** | **Flutter (Android / iOS / Web)** | 免密验证码快速登录、校车实时位置地图追踪、到站 ETA 预计、学生请假通知 |
| **调度台桌面前端 (`web`)** | **React + TypeScript + Vite + Tailwind CSS** | 高信息密度看板、排班排表、BusPlanner staging、临时替换、车辆与员工合规管理、AI Copilot 语音调度台（支持 PWA 独立安装） |
| **后端 API 服务 (`server`)** | **Go (Golang 1.24+) + Chi Router** | 高性能微服务（CQRS 架构、Twilio 短信、BusPlanner staging、Zonar GPS、ETA 路径计算、实时审计与认证、双引擎 AI Copilot） |
| **MCP 标准协议服务 (`server/cmd/mcp`)** | **Go + Anthropic MCP SDK** | 标准 Model Context Protocol 服务端，支持外部 Claude Desktop / Cursor / 自主 Agent 接入安全执行调度操作 |
| **云端数据与通信** | **Firebase / Firestore / Cloud Storage / Cloud Run** | 实时推送、分布式事件驱动同步、全自动缩容至 0 的无服务器托管 |
| **数据仓库与冷备** | **Google BigQuery** | 历史调度与出勤数据长期安全归档分析 |

---

## 项目 Monorepo 目录结构

```text
DispatchFirebase/
├── driver_app/                      # 司机端 Flutter 应用 (移动端与 Web)
│   ├── lib/
│   │   ├── firebase_options.dart.example  # Firebase 客户端配置模板
│   │   ├── features/auth/                 # 身份认证与出勤
│   │   └── features/dispatch/             # 班车排班与学生签到
│   └── web/firebase-messaging-sw.js.example # Web 推送 ServiceWorker 模板
├── parent_app/                      # 家长端 Flutter 应用 (实时校车追踪)
│   ├── lib/core/api_client.dart     # 后端 API 客户端 (支持 --dart-define=API_BASE_URL)
│   ├── lib/features/tracking/       # OpenStreetMap 实时校车位置图层与路线
│   └── lib/features/auth/           # 家长免密 Passcode 认证
├── web/                             # 调度台 React + Vite 前端应用
│   ├── .env.example                 # Web 端环境变量模板
│   └── src/                         # 控制台页面、组件、AI Copilot 与状态管理
├── server/                          # Go 后端 API 服务
│   ├── cmd/server/main.go           # Web API 服务入口
│   ├── cmd/mcp/main.go              # Anthropic MCP 服务端程序入口
│   ├── cmd/seed/main.go             # 初始主数据与测试数据生成工具
│   └── internal/                    # 认证、仓储层、ETA、邮件/短信服务、AI 调度引擎与 MCP 处理器
├── deploy/                          # Google Cloud Run 部署脚本
├── .env.example                     # 后端与全系统环境变量模板
├── firestore.rules                  # Firestore 安全规则
├── README.md                        # 英文主说明文档
├── README.fr.md                     # 法语说明文档
└── README.zh-CN.md                  # 中文说明文档
```

---

## 快速上手与本地配置指南

本项目已对生产环境凭据进行彻底解耦，请按以下步骤配置您的开发环境。

### 1. 后端环境配置 (`server`)

1. 复制根目录环境变量模板：
   ```bash
   cp .env.example .env
   ```
2. 编辑 `.env` 文件，填入您的配置（本地开发使用默认参数即可）。
3. 启动 Go 后端服务：
   ```bash
   cd server
   go run ./cmd/server
   ```
   服务将监听 `http://localhost:8080`。
4. *(可选)* 启动本地独立 MCP Server：
   ```bash
   cd server
   go run ./cmd/mcp
   ```

---

### 2. 司机端配置与运行 (`driver_app`)

1. 配置 Firebase：
   - **方式 A (推荐)**：在 `driver_app` 根目录执行 `flutterfire configure` 自动关联您的 Firebase 项目。
   - **方式 B**：复制模板文件并填入凭据：
     ```bash
     cd driver_app
     cp lib/firebase_options.dart.example lib/firebase_options.dart
     cp web/firebase-messaging-sw.js.example web/firebase-messaging-sw.js
     ```
2. 获取依赖并启动应用：
   ```bash
   flutter pub get
   flutter run -d chrome  # 或运行于 Android / iOS 模拟器
   ```

---

### 3. 家长端配置与运行 (`parent_app`)

家长端无需直接集成 Firebase SDK，直接连接 Go 后端 API：

```bash
cd parent_app
flutter pub get

# 本地调试 (默认连接 http://localhost:8080)
flutter run -d chrome

# 生产环境编译 (自定义后端 API 地址)
flutter build web --dart-define=API_BASE_URL=https://your-api-domain.com
```

---

### 4. 调度台控制中心 (`web`)

1. 配置环境变量：
   ```bash
   cd web
   cp .env.example .env.local
   ```
2. 启动前端 Vite 开发服务器：
   ```bash
   npm install
   npm run dev
   ```
   在浏览器访问 `http://localhost:3000`。

---

## 安全与开源规范

- **凭证安全**：请**切勿**将包含真实密钥的 `serviceAccountKey.json`、`firebase_options.dart`、`.env` 提交至代码仓库。所有此类文件已被 `.gitignore` 严格排除。
- **Firestore 生产级规则与行级防泄露**：内置完整的生产级 `firestore.rules`，通过内存动态裁决模块覆盖与行级所有权（零额外读计费）；客户端严格配合使用 `where('employeeId', '==', id)` 定向检索，彻底避免越权与数据泄露。
- **对接密钥**：BusPlanner、Zonar、BambooHR 的凭据，以及 BusPlanner staging 集合，只允许 API 读取。Firestore 规则拒绝浏览器访问。
- **MCP Token 安全**：MCP Token 存储于 Firestore 私有集合中并采用安全加盐哈希，客户端只在生成时可见一次，避免长效明文泄露。

---

## 🛠️ 运维与数据生命周期管理指南

- 📘 **[Firestore TTL 与 Cloud Scheduler 自动化归档配置指南](docs/firestore-ttl-cloud-scheduler-instructions.md#简体中文)**（提供 **English**、**Français**、**简体中文** 三语版本）：
  - Google Cloud 控制台中的 Firestore 自动过期（TTL）规则设置说明。
  - Cloud Scheduler 唯一聚合归档任务（`/api/admin/archive/sync-all`）配置步骤，一键归档班次、流水日志及过期请假单，实现超低云端运行开销。
  - Firestore 热存储与 BigQuery 冷存储的双引擎无感知智能路由与兜底机制。

---

## 开源许可证 (License)

本项目基于 [MIT 许可证](LICENSE) 开源。
