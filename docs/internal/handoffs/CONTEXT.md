# Codex 上下文：喵街每日 AI 变装副本

## 项目北极星

这是银泰商业挑战赛 H5 原型。首要目标不是展示人体重建技术，而是让 18—40 岁喵街中低频会员：

1. 因每日更新的玩法钩子打开 APP；
2. 在玩法中完成真实社交动作；
3. 感知 AI 对内容与决策的实质影响；
4. 被门店库存、试穿券和任务引导到复购。

任何新功能都必须先回答它如何改善日开、分享、活跃或复购。Avatar、NeRF、rig、换装属于内容生产能力，不再主导产品路线。

## 当前主体验（2026-07-25 更新）

**重要：以下描述反映已发布产品机制。历史版本使用 A/B 裁决、倒计时、assist= 参数等旧机制，已全部替换。**

公开入口：`/#/game`，根路由跳转到该页面。

每日循环：

```text
每日城市角色章节（天气 + 商圈 + 商品池）
  -> 上传照片，建立动漫身份
  -> 不限时选择 5 层穿搭（内搭/外套/下装/鞋/配饰）
  -> 编辑发型、动作、表情与背景
  -> AIGC 生成个人角色与分享海报
  -> 分享房间链接，好友带自己的身份和 Look 加入
  -> 2–4 人共创同框（并肩/击掌/走秀/自拍）
  -> 自愿公开到穿搭广场，其他用户可发现同款
  -> 看详情 / 门店任务 / 次日章节预告
```

社交入口：`/#/game?join=<sceneId>&max=4&host=<productIds>`。好友不是评委或投票工具；每位好友独立上传照片、选择完整穿搭，生成统一风格的多人海报。

## AIGC 的实质作用

`DailyQuestAigcProvider` 负责两类生成：

- 根据天气、场景、风格标签和库存生成每日任务与候选商品池；
- 根据用户选择生成个人角色、动作/表情变体、多人构图和广场公开内容。

当前默认实现 `DemoPersonalizedQuestProvider` 是可运行、确定性的演示 Provider，结果会真实随商品标签与库存变化，不冒充远程大模型。`GatewayDailyQuestAigcProvider` 已预留生产 AIGC 接口。

关键文件：

- `src/pages/DailyQuestPage.tsx`：大厅、5 层选搭、角色编辑、生成、分享、好友共创、广场、门店任务；
- `src/services/dailyQuestAigcProvider.ts`：演示与 Gateway AI Provider；
- `src/stores/useDailyQuestStore.ts`：连续天数、角色资产与分享状态；
- `src/types/dailyQuest.ts`：任务、选择和生成结果类型；
- `src/components/common/BottomNav.tsx`：将"今日副本"设为主入口。

## 商业闭环

- 日开：每日场景、不限时创作、7 日 streak、角色资产成长；
- 社交：每位好友独立角色，2–4 人同框，双方都有专属内容；
- 线上活跃：创作、编辑、邀请、广场浏览与点赞；
- 线下转化：商品映射门店楼层和库存，分享房间后可解锁试穿任务；
- 复购：商品池按日刷新，角色资产和连续收藏形成次日回访理由。

## Avatar / NeRF 定位

五视角动漫头部生成、stylized avatar、rigged avatar 和 garment 代码可以保留并继续演进，但它们只负责提升未来 AI 海报和角色内容质量。旧 silhouette carving、圆柱人体和低质量 procedural body 只能作为 legacy fallback，禁止重新成为首页或比赛主叙事。

## 部署

```bash
npm run build
npx wrangler pages deploy dist --project-name=ai-meow-outfit
```

生产环境的私有 AIGC 必须经 API Gateway 调用，凭据仅存环境变量或 platform secret，不得写入仓库。开发和部署都只在 `next-gen-avatar` 分支进行，不修改 `main`。

## 下一步原则

优先补真实后端：每日任务配置、好友助力回执、券核销和埋点漏斗。除非它直接改善评审可见体验，不再投入时间打磨旧人体几何。
