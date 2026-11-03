# 家长端应用单元与组件测试指南 (Parent App Testing Guide)

[English](TESTING.md) | [Français](TESTING.fr.md) | [中文](TESTING.zh.md)

本项目包含一套全面、高响应、零多余外部依赖的单元与组件测试套件（共 51 个测试用例），完整覆盖家长端校车追踪应用的纯算法、模型解析、认证状态机流转与全部核心用户界面（实时追踪 Bento、行程主日历、调度台双向沟通、通知设置与资料维护）。

---

## 1. 快速上手

确保工作目录为 `parent_app`：

```bash
cd parent_app
```

### 1.1 运行全部测试
数秒内执行全量 51 个单元与 Widget 测试：

```bash
flutter test
```

### 1.2 分模块运行 (P0, P1, P2)

| 级别 | 测试模块 | 覆盖规则与内容 | 运行指令 |
| :---: | :--- | :--- | :--- |
| **P0** | **道路吸附计算引擎** | Google 编码 Polyline 解码、Web 端负数位运算防溢出、Haversine 45米阈值内道路投影、线段航向角推算 | `flutter test test/map_snapping_engine_test.dart` |
| **P0** | **数据模型与容错解析** | `fromJson` 缺失字段默认填充、经纬度 `num` 自动转 `double`、嵌套车辆定位解析、序列化往返一致性 | `flutter test test/models_test.dart` |
| **P0** | **认证状态机 BLoC** | 初始状态、Session 自动恢复、OTP 验证码请求与校验、永久注册、异常捕获与登出凭证注销 | `flutter test test/auth_bloc_test.dart` |
| **P1** | **预计到达 ETA 卡片** | `EN_ROUTE` 倒计时与距离展示、`APPROACHING` 快速到站提示、`DROPPED_OFF` 安全送达、快捷呼叫与请假触发 | `flutter test test/eta_card_widget_test.dart` |
| **P1** | **免密登录界面** | 空输入校验拦截、Demo 手机/邮箱快捷填充、零门槛免密横幅提示、加载状态按钮防重 | `flutter test test/login_screen_test.dart` |
| **P1** | **验证码输入页面** | 关联学生数量徽章、6位动态码校验提交、短码拦截提示 SnackBar、DevCode 快捷填充 | `flutter test test/otp_screen_test.dart` |
| **P1** | **行程日程表** | AM/PM/周五早退时段过滤、工作日快照矩阵、多学生一键切换、请假入口触发 | `flutter test test/schedule_screen_test.dart` |
| **P1** | **校车地图折线图层** | 动态解码行程 Polyline 并正确挂载 `RoadPolylineLayer` 图层 | `flutter test test/bus_map_test.dart` |
| **P2** | **调度中心联系工作台** | 双 Tab 交互（`Live Chat` 与 `Call / SMS`）、调度热线 `(613) 555-0100` 与短信通道 `(613) 555-0188` | `flutter test test/dispatcher_contact_sheet_test.dart` |
| **P2** | **通知预警设置** | 到站预警滑块（3-15分钟）、推送/短信/邮件多渠道开关切换与持久化存储 | `flutter test test/notification_settings_sheet_test.dart` |
| **P2** | **个人资料编辑** | 现有资料回显预填、姓名/电话/邮箱/家庭住址编辑与格式校验、保存回调 | `flutter test test/edit_profile_sheet_test.dart` |
| **App** | **应用根入口渲染** | 根组件 `ParentApp` 挂载与首屏路由渲染 | `flutter test test/widget_test.dart` |

### 1.3 静态代码质量分析
执行 Dart 静态分析，确保 0 警告与 0 错误：

```bash
flutter analyze
```

---

## 2. 测试架构与目录组织

```text
parent_app/test/
├── auth_bloc_test.dart                 # [P0] 认证状态机与 MockApiClient
├── bus_map_test.dart                   # [P1] 地图组件与道路折线图层
├── dispatcher_contact_sheet_test.dart  # [P2] 调度中心服务台 (在线客服与电话短信)
├── edit_profile_sheet_test.dart        # [P2] 个人资料编辑与输入校验
├── eta_card_widget_test.dart           # [P1] Bento 到站卡片与快捷操作
├── login_screen_test.dart              # [P1] 登录首屏与表单校验
├── map_snapping_engine_test.dart       # [P0] 几何投影、道路吸附与航向角
├── models_test.dart                    # [P0] 数据模型解析与容错序列化
├── notification_settings_sheet_test.dart # [P2] 预到站通知与渠道偏好设置
├── otp_screen_test.dart                # [P1] 动态验证码校验与防溢出
├── schedule_screen_test.dart           # [P1] 校车行程时刻表与时段筛选
└── widget_test.dart                    # [Core] 应用顶层组件装载测试
```
