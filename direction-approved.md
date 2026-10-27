# Direction Approval Status: PCY Driver App Mobile Optimization

## 用户决策记录
- **用户选定方向**：**方向 C (Direction C: 任务流折叠看板 · Mission Sheet & Flow)**
- **用户原话**：`方向 C`
- **批准时间**：2026-10-26T11:29:19-04:00
- **生效原型文档**：[Direction-C-Mission-Sheet.html](file:///d:/DispatchFirebase/design-demos/Direction-C-Mission-Sheet.html)

## 核心设计规范与实施要点
1. **单任务绝对聚焦（Current Mission Focus Card）**：
   - 司机端核心卡片始终聚焦在“当前唯一步骤”（例如：若正在前往 Stop #2，卡片巨大居中展示 Stop #2 目的地、预计时间、学生乘车人数与一键到站/离站动作；已完成的自动折叠，未开始的收纳在底部展开抽屉中）。
2. **顶部 4 阶段微型进度条（Micro-Stepper Bar）**：
   - 将常规班次与包车 4 站行程（#1 早上接人 → #2 目的地送达 → #3 下午返程接人 → #4 学校送达）直观显示为 4 段式进度胶囊条，当前 Leg 动态微脉动提示。
3. **沉浸式即开即关行程抽屉（Collapsible Itinerary Sheet）**：
   - 司机轻点抽屉即可展开查阅全部 4 站完整明细与地图导航，默认折叠避免遮挡当前核心操作。
4. **单手拇指吸底大按键（Bottom-Anchored Thumb Action）**：
   - 到站打卡（Mark Arrived）、签到（Check-In）采用屏幕底部固定全宽大按键（高度 ≥56px），防颠簸误触。
5. **已核定费率与工时透视（Transparent Rate & EI Hours）**：
   - 签到后以绿色高亮胶囊清晰展示 `$150.00 Driver Rate • 5.0h EI`，消除薪资疑虑。
