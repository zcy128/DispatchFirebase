# 司机端应用程序 (Driver App)

校车调度与路线管理司机端移动应用 (Flutter)。

[English](README.md) | [Français](README.fr.md) | [中文](README.zh.md)

---

## 🚀 快速上手 (Getting Started)

1. **安装依赖**：
   ```bash
   flutter pub get
   ```

2. **运行应用**：
   ```bash
   # Demo 演示模式（默认）
   flutter run -d chrome
   
   # 或指定生产模式
   flutter run --dart-define=APP_MODE=production
   ```

---

## 📁 目录结构 (Directory Structure)

```text
driver_app/
├── lib/
│   ├── core/                        # 网络层、鉴权拦截器、主题与离线存储
│   ├── features/                    # 核心业务功能模块
│   │   ├── auth/                    # 司机身份认证、Demo 登录与会话管理
│   │   ├── charter/                 # 包车订单、站点序列与时间换算
│   │   ├── chat/                    # 即时通讯频道、多媒体附件与调度私信
│   │   ├── defect/                  # 车辆缺陷上报与维修历史跟踪
│   │   ├── dispatch/                # 班次调度主流程、签到与签退生命周期
│   │   ├── expense_reimbursement/   # 费用报销申报与发票凭证上传
│   │   ├── forms/                   # 司机休假与请假审批流程
│   │   ├── hazard_report/           # 道路与安全隐患上报
│   │   ├── pretrip/                 # 发车前安全合规检查（安省 199/07 法规）
│   │   ├── route/                   # 路线站点花名册、出发时间与学生考勤
│   │   ├── timesheet/               # 双周薪资工时汇总与法定节假日津贴
│   │   └── vehicle_signout/         # 车辆借出与归还审核
│   └── firebase_options.dart.example# Firebase 客户端配置模板
├── test/                            # 自动化单元测试套件 P0-P2 (49+ 测试用例)
├── TESTING.md                       # 多语言单元测试指南 (中/英/法)
└── web/                             # Web 入口与 ServiceWorker 模板
```

---

## 🧪 单元测试指南 (Unit Testing)

本项目配备了一套**轻量、极速、零外部网络依赖**的自动化单元测试套件，全面覆盖司机端核心业务逻辑计算、考勤工时与薪资、发车前安全检查法规评定、网络鉴权拦截及弱网离线保活机制。

### 1. 运行核心业务单元测试
在 `driver_app` 根目录下执行：

```bash
flutter test \
  test/features/timesheet/timesheet_model_test.dart \
  test/features/charter/charter_model_test.dart \
  test/features/chat/chat_model_test.dart \
  test/features/route/route_model_attendance_test.dart \
  test/core/network/api_client_error_handling_test.dart \
  test/features/pretrip/pretrip_status_rules_test.dart \
  test/core/services/storage_service_resilience_test.dart \
  test/features/auth/session_cleanup_test.dart
```

> **执行性能**：全部 49+ 个核心测试用例执行耗时仅需 **5~6 秒**，纯内存运算，无需连接外部网络或真实 Firebase。

### 2. 按业务模块单独测试命令速查

- **考勤与工时薪资计算**：
  ```bash
  flutter test test/features/timesheet/timesheet_model_test.dart
  ```
- **包车业务与站点时间推算**：
  ```bash
  flutter test test/features/charter/charter_model_test.dart
  ```
- **即时通讯与消息反序列化**：
  ```bash
  flutter test test/features/chat/chat_model_test.dart
  ```
- **路线与学生考勤名单模糊检索**：
  ```bash
  flutter test test/features/route/route_model_attendance_test.dart
  ```
- **网络层异常与鉴权拦截**：
  ```bash
  flutter test test/core/network/api_client_error_handling_test.dart
  ```
- **发车前安全检查（安省法规评级）**：
  ```bash
  flutter test test/features/pretrip/pretrip_status_rules_test.dart
  ```
- **弱网断网 Base64 降级保活**：
  ```bash
  flutter test test/core/services/storage_service_resilience_test.dart
  ```
- **登出数据物理清除与会话隔离**：
  ```bash
  flutter test test/features/auth/session_cleanup_test.dart
  ```

详细的测试分层架构、Mock 规范及避坑指南请查阅：👉 **[TESTING.zh.md](./TESTING.zh.md)**（另提供 [English](./TESTING.md) 和 [Français](./TESTING.fr.md) 版本）。
