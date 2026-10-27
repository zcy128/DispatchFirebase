# Brand Specification: PCY School Bus Driver App

## 1. 品牌定位与应用场景
- **应用名称**：PCY Dispatch Driver & Monitor Mobile App
- **用户角色**：校车司机（School Bus Drivers）与随车监护员/跟车员（Attendants）
- **核心使用环境**：校车驾驶舱、户外阳光直射/逆光、强光眩光、手套或颠簸环境、早晨 6:00 昏暗出车前检查。
- **首要任务**：出勤签到打卡（Check-In / Out）、Schedule 5 出车前数字点检、日常早/午/晚班次运行、包车（Charter）4 站行程逐站打卡与到站确认、学生乘降考勤与扫码。

## 2. 视觉基准与色彩推导
- **标志性校车警示黄（School Bus Chrome Yellow）**：`#F59E0B` / `#D97706`（高识别度、合规警示、温暖可信）
- **驾驶舱深色基调（Cockpit Dark Canvas）**：`#0A0D14` / `#111827`（防眩光、高对比度、省电护眼）
- **高明度语义状态色**：
  - 成功/已签到/正常：翡翠绿 `#10B981` / `#059669`
  - 警告/待点检/空缺：琥珀橙 `#F59E0B`
  - 紧急/故障报修/危险：珊瑚红 `#EF4444`
  - 资讯/包车/跟车员：电光青蓝 `#06B6D4` / 智慧紫 `#8B5CF6`
- **中性层级（Neutral Grayscale）**：
  - 浅色模式背景：`#F8FAFC`，卡片表面 `#FFFFFF`，边框 `#E2E8F0`
  - 深色模式背景：`#0A0D14`，卡片表面 `#151B28`，边框 `#253046`

## 3. 人机工学与触控标准（Mobile Ergonomics）
- **大号交互靶心**：行车关键动作（签到、到站打卡、开门乘降）按键高度 ≥56px，次级按键 ≥44px。
- **单手拇指黄金区（Thumb Zone）**：主动作条一律采用屏幕底部吸底（Bottom-Anchored Bar）布局，单手单指即可触达。
- **超强信息扫读性（Glanceability）**：车号（Bus #）、当前站点名（Current Stop）、离站倒计时（Departure Time）采用 20~28px 粗体高反差字体，驾驶位一瞥即知。
- **状态透明度**：Check In 成功后立即显示核定 Payroll Rate（如 `$150.00 • 5.0h EI`），零歧义。
