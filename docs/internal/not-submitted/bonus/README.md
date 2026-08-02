# AI 喵搭 - 比赛选交材料索引

这套材料只证明当前可验证能力，并清楚区分“已经运行”“效果演示”和“生产接入目标”。建议评委按下列顺序查看。

## 1. 可访问产品

- 在线 H5：[AI 喵搭 - 银泰每日角色副本](https://next-gen-avatar.ai-meow-outfit.pages.dev/#/game)
- 核心路径：每日故事 → 身份输入 → 5 层完整穿搭 → AIGC 角色 → 动作/表情/背景 → 好友邀请 → 2–4 人共创 → 银泰穿搭广场
- 好友入口：由结果页生成带 `join` 参数的邀请链接；好友需要建立自己的身份并选择自己的完整 Look。

## 2. 项目演示视频

- 最终 MP4：[`../video-v2/output/AI喵搭-比赛演示-v2.mp4`](../video-v2/output/AI喵搭-比赛演示-v2.mp4)
- 时长：144 秒，1920×1080，30fps，H.264，带中文旁白
- 视频工程：[`../video-v2/`](../video-v2/)
- 叙事原则：不使用倒计时、不使用 A/B 裁决、不把好友当投票工具；好友会创建自己的角色并加入同框。

## 3. 工作流与架构

- 汇总 PDF：[`加分材料-工作流与架构.pdf`](加分材料-工作流与架构.pdf)
- Agent 工作流：[`diagrams/agent-workflow.svg`](diagrams/agent-workflow.svg)
- 系统架构：[`diagrams/system-architecture.svg`](diagrams/system-architecture.svg)
- 项目真实性说明：[`项目真实性证据.md`](项目真实性证据.md)
- 样例 Prompt：[`样例Prompts.md`](样例Prompts.md)
- 原型访问与验收路径：[`原型访问与验收路径.md`](原型访问与验收路径.md)

## 4. 运行证据

- 关键流程截图：[`screenshots/`](screenshots/)
- 截图总览：[`screenshots/contact-sheet.png`](screenshots/contact-sheet.png)
- 机器可读验证记录：[`run-records/validation.json`](run-records/validation.json)
- 浏览器验证：430×932 手机视口；好友邀请链接可进入独立身份/选装页；控制台 error/warn 为 0。

## 能力边界

| 层级 | 当前状态 | 证据 |
|---|---|---|
| 每日打开与 7 天章节 | 已运行 | H5 首页与源码 |
| 商品图优先、选中下沉、单独详情 | 已运行 | H5 交互截图 |
| 个人角色、动作、表情、背景编辑 | 效果演示已运行 | `providerStage=effect-preview` |
| 好友邀请与 2–4 人房间 | 本地闭环已运行 | 邀请页、双人席位截图 |
| 银泰穿搭广场 | 前端演示已运行 | 主动公开开关与广场截图 |
| 私有 GPU / Gateway AIGC | 接口和实验代码已具备 | Provider、Worker、NeRF 代码；本材料不冒充已完成生产联调 |
| 银泰 PIM / 库存 | 生产接入目标 | 当前为项目内样例商品字段与商品图示意 |

## 现场演示建议

1. 扫码打开 H5，指出“约 60 秒完成 · 不限时”。
2. 进入选装，演示卡片下沉；再用“查看详情”打开商品字段。
3. 直接预览角色结果，切换动作与表情。
4. 打开“共创”，演示第 2 位角色加入，并展示好友邀请入口。
5. 回到首页展示银泰穿搭广场和同款商品回流逻辑。
