# Driver App 单元测试指南

[English](TESTING.md) | [Français](TESTING.fr.md) | [中文](TESTING.zh.md)

本项目包含一套轻量、高速、零外部网络依赖的单元测试套件，全面覆盖司机端移动应用的核心业务逻辑、薪资考勤计算、发车合规检查、网络容错及离线保活机制。

---

## 1. 快速上手

运行测试前，请确保当前工作目录位于 `driver_app` 下：

```bash
cd driver_app
```

### 1.1 运行核心业务全套测试 (P0 + P1 + P2)
运行全部 49+ 个核心测试用例：

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

### 1.2 按业务模块单独测试

| 模块 | 说明 | 运行命令 |
| :--- | :--- | :--- |
| **工时与薪酬 (Timesheet)** | 时薪除零防护、双周汇总、跨天排班归类 | `flutter test test/features/timesheet/timesheet_model_test.dart` |
| **包车业务 (Charter)** | 站点时间推算、跨午夜时间翻转、往返站点归一化 | `flutter test test/features/charter/charter_model_test.dart` |
| **即时通讯 (Chat)** | 频道枚举解析、带媒体附件消息反序列化、通讯录兜底 | `flutter test test/features/chat/chat_model_test.dart` |
| **路线与考勤 (Route)** | 学生跨班次全局去重统计、多字段模糊搜索 | `flutter test test/features/route/route_model_attendance_test.dart` |
| **网络与鉴权 (Network)** | Bearer Token 注入与清除、401/403/500 状态码转换 | `flutter test test/core/network/api_client_error_handling_test.dart` |
| **出车前检查 (Pre-Trip)** | 安省法规评级（严重缺陷强制阻断）、里程数完整性校验 | `flutter test test/features/pretrip/pretrip_status_rules_test.dart` |
| **存储与降级 (Storage)** | 离线/弱网 Base64 降级保活、扩展名推导 MIME 类型 | `flutter test test/core/services/storage_service_resilience_test.dart` |
| **会话安全 (Session)** | 登出敏感令牌物理清除、保留非敏感设备偏好 | `flutter test test/features/auth/session_cleanup_test.dart` |

### 1.3 代码测试覆盖率报告

```bash
flutter test --coverage
# 如需生成 HTML 网页报告（需安装 lcov 工具）：
# genhtml coverage/lcov.info -o coverage/html
```

---

## 2. 测试架构与目录分层

```text
driver_app/test/
├── core/
│   ├── network/
│   │   └── api_client_error_handling_test.dart  # 网络层鉴权拦截与异常映射
│   └── services/
│       └── storage_service_resilience_test.dart # 离线 Base64 降级与 MIME 推导
├── features/
│   ├── auth/
│   │   └── session_cleanup_test.dart            # 会话持久化与登出数据隔离
│   ├── charter/
│   │   └── charter_model_test.dart              # 包车站点、往返归一化与时间推算
│   ├── chat/
│   │   └── chat_model_test.dart                 # 消息模型与频道反序列化
│   ├── pretrip/
│   │   └── pretrip_status_rules_test.dart       # 安省 199/07 发车合规与缺陷判定
│   ├── route/
│   │   └── route_model_attendance_test.dart     # 考勤学生去重与模糊查询
│   └── timesheet/
│       ├── timesheet_model_test.dart            # 工时薪酬聚合计算与除零防护
│       └── timesheet_period_test.dart           # 夏令时 14 天周期测试
```

---

## 3. 编写新测试的规范与避坑指南

### 3.1 务必首先初始化 Binding
在所有涉及 `SharedPreferences`、文件操作或底层平台插件的测试文件首行加入：
```dart
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  // ...
}
```
*避免出现 `ServicesBinding binding mixin is only available once that binding has been initialized` 异常。*

### 3.2 隔离真实网络请求（使用 `MockClient`）
**严禁**在单元测试中直接发起真实 HTTP 请求。使用 `package:http/testing.dart` 中的 `MockClient` 进行模拟：
```dart
import 'package:http/testing.dart';

final mockClient = MockClient((request) async {
  if (request.url.path.contains('/api/example')) {
    return http.Response('{"status": "ok"}', 200);
  }
  return http.Response('Not Found', 404);
});
```

### 3.3 测试用例间重置本地缓存
在 `setUp` 阶段重置本地缓存，防止不同测试用例之间相互污染：
```dart
setUp(() {
  SharedPreferences.setMockInitialValues({});
  AuthenticatedHttpClient.setToken(null);
});
```

### 3.4 边界用例防范清单
- **除以 0 / 负数**：如工时、金额等数字计算必须防范除以零崩溃（如 `payAmount / eiHours`）。
- **时间跨界**：跨午夜（如 `23:45 + 30m`）、跨月底、夏令时切换点（DST）。
- **字段空值容错**：后端 JSON 返回 `null`、缺少字段或空字符串时的安全解析。
