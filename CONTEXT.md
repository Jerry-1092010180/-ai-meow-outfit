# Codex 上下文：喵街每日 AI 变装副本

## 项目北极星

这是银泰商业挑战赛 H5 原型。首要目标不是展示人体重建技术，而是让 18—40 岁喵街中低频会员：

1. 因每日更新的玩法钩子打开 APP；
2. 在玩法中完成真实社交动作；
3. 感知 AI 对内容与决策的实质影响；
4. 被门店库存、试穿券和任务引导到复购。

任何新功能都必须先回答它如何改善日开、分享、活跃或复购。Avatar、NeRF、rig、换装属于内容生产能力，不再主导产品路线。

## 当前主体验

公开入口：`/#/game`，根路由也会跳转到该页面。

每日循环：

```text
每日场景 + 天气 + 用户风格 DNA + 银泰在售库存
  -> 60 秒三轮商品选择
  -> AI 评分、个性化叙事与可分享时尚海报
  -> 邀请好友完成 A/B 最终裁决
  -> 解锁数字衣橱卡与到店试穿券
  -> 明日副本预告 + 7 日连续任务
```

好友链接：`/#/game?assist=<code>`。被邀请者必须实际选择 LOOK A 或 LOOK B，不能只打开广告页。投票后获得灵感值与裁判徽章，并可回流“我也开一局”。

## AIGC 的实质作用

`DailyQuestAigcProvider` 负责两类生成：

- 根据天气、场景、风格标签和库存生成每日任务与候选商品池；
- 根据用户选择生成多维评分、个性化结论、故事文案、标签、备选商品和分享海报内容。

当前默认实现 `DemoPersonalizedQuestProvider` 是可运行、确定性的演示 Provider，结果会真实随商品标签与库存变化，不冒充远程大模型。`GatewayDailyQuestAigcProvider` 已预留生产 AIGC 接口。

关键文件：

- `src/pages/DailyQuestPage.tsx`：大厅、三轮选择、生成、结果、分享、好友裁决、到店任务；
- `src/services/dailyQuestAigcProvider.ts`：演示与 Gateway AI Provider；
- `src/stores/useDailyQuestStore.ts`：连续天数、灵感值、分享与助力状态；
- `src/types/dailyQuest.ts`：任务、选择和生成结果类型；
- `src/components/common/BottomNav.tsx`：将“今日副本”设为主入口。

## 商业闭环

- 日开：每日场景、60 秒限时任务、7 日 streak、明日预告；
- 社交：好友 A/B 裁决是奖励解锁条件，双方都有收益；
- 线上活跃：任务、分数、数字收藏与可重复出片；
- 线下转化：商品映射到武林银泰楼层和库存，好友裁决后解锁试穿券；
- 复购：商品池按日刷新，收藏、券和门店任务形成下一次购买理由。

## Avatar / NeRF 定位

五视角动漫头部生成、stylized avatar、rigged avatar 和 garment 代码可以保留并继续演进，但它们只负责提升未来 AI 海报和角色内容质量。旧 silhouette carving、圆柱人体和低质量 procedural body 只能作为 legacy fallback，禁止重新成为首页或比赛主叙事。

## 部署

```bash
npm run build
npx wrangler pages deploy dist --project-name=ai-meow-outfit
```

生产环境的私有 AIGC 必须经 API Gateway 调用，凭据仅存环境变量或平台 secret，不得写入仓库。开发和部署都只在 `next-gen-avatar` 分支进行，不修改 `main`。

## 下一步原则

优先补真实后端：每日任务配置、好友助力回执、券核销和埋点漏斗。除非它直接改善评审可见体验，不再投入时间打磨旧人体几何。
