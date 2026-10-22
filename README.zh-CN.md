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
| **司机与跟车员端 (`driver_app`)** | [schoolbus.pcytech.ca/driver](https://schoolbus.pcytech.ca/driver)<br>*(备用: [schoolbusdispatchapp.web.app/driver](https://schoolbusdispatchapp.web.app/driver))* | 在登录界面点击下方的 **「Quick Demo Credentials」**（填充演示凭据）按钮即可自动填入演示账号（`driver@example.com` / `password123`），角色选择「Driver」或「Attendant」，点击 **Sign In** 即可进入排班看板、Pre-trip 检查与学生签到界面。 |
| **家长实时追踪端 (`parent_app`)** | [schoolbus.pcytech.ca/parent](https://schoolbus.pcytech.ca/parent)<br>*(备用: [schoolbusdispatchapp.web.app/parent](https://schoolbusdispatchapp.web.app/parent))* | 采用无密码安全验证码机制。在登录页面直接点击 **「Demo Phone」** 或 **「Demo Email」** 按钮自动填入，点击 **Continue** 后，在验证码输入页轻点黄色的 **「Dev Passcode (Tap to autofill)」** 即可自动填充验证码并登录，立即查看校车实时 GPS 地图轨迹与到站预计。 |
| **MCP 模型上下文协议端点** | `https://dispatch-api-kv7qum3dca-nn.a.run.app/api/mcp` | 标准 Anthropic MCP 协议服务端点，供 Claude Desktop、Cursor、Gemini 等外部 AI 客户端通过 MCP Token 接入直接对话调度系统。 |

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

### 11. 细粒度 RBAC 页面级权限隔离
- 严密的基于角色权限控制（Role-Based Access Control），可精细化配置不同角色（管理员、调度员、车场主管、安全员、财务会计、司机、家长）对每一个菜单和数据页面的读写权限。

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
- **Firestore 规则收紧**：在将系统投入正式商用或连接线上数据库前，请务必根据业务权限需求更新 `firestore.rules` 中的安全鉴权条件，以防未授权访问。
- **对接密钥**：BusPlanner、Zonar、BambooHR 的凭据，以及 BusPlanner staging 集合，只允许 API 读取。Firestore 规则拒绝浏览器访问。
- **MCP Token 安全**：MCP Token 存储于 Firestore 私有集合中并采用安全加盐哈希，客户端只在生成时可见一次，避免长效明文泄露。

---

## 开源许可证 (License)

本项目基于 [MIT 许可证](LICENSE) 开源。
