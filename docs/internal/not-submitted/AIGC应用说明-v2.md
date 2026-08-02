# AIGC 实质应用说明

## 结论

AIGC 是“AI 喵搭”的内容生产引擎，而不是概念点缀。用户每天打开后获得的个人角色、动作/表情变体、好友多人海报和广场内容都由结构化生成任务驱动。

## 输入与输出

**输入**

- 用户身份参考：脸型、五官比例、发型与授权状态。
- 完整穿搭：内搭、外套、下装、鞋履、配饰。
- 每日上下文：日期、天气、商圈、章节剧情。
- 内容偏好：发型、动作、表情、背景。
- 社交上下文：2–4 位成员、各自角色与互动模板。

**输出**

- 保留身份特征的动漫角色内容。
- 同一身份下的动作、表情和背景版本。
- 保留每位成员身份与商品的多人互动海报。
- 广场标题、标签和可回流商品清单。

## Agent / Provider 流程

```text
DailyQuestOrchestrator
├─ IdentityProvider
├─ ProductResolver
├─ StoryPlanner
├─ SocialAvatarImageProvider
├─ SocialSceneComposer
└─ ValidationGate
   ├─ identity score
   ├─ per-layer product consistency
   ├─ anatomy / composition
   ├─ privacy / moderation
   └─ providerStage / traceId / fallbackReason
```

## 当前与生产 Provider

| 模块 | 当前原型 | 生产替换 |
|---|---|---|
| 每日任务 | `DemoPersonalizedQuestProvider` | `GatewayDailyQuestAigcProvider` |
| 个人角色 | `providerStage=effect-preview` | 身份保持型动漫角色 Provider |
| 多人场景 | 本地房间 + 效果海报 | Gateway Social Scene Provider |
| 商品数据 | 项目样例字段 | 银泰 PIM / 库存 / 授权商品图 |
| 资产回传 | 前端资源 | R2 / CDN URL |

## 为什么不是普通规则推荐

规则可以筛商品，但不能完成以下任务：

1. 把用户身份统一成漫画视觉并保持可辨识度。
2. 将 5 层商品合成为一个协调的人物画面。
3. 保持同一身份，生成不同动作、表情和背景内容。
4. 在 2–4 人场景中保持每个人的脸与穿搭不串位。
5. 对生成结果做视觉一致性检查并局部重试。

因此 AIGC 直接决定可消费、可分享的内容产出，是玩法成立的必要条件。

## 动态视频生成扩展

除静态角色海报外，技术路线支持扩展为 5–15 秒动态商品展示短片。

### 生产能力

- 写实真人商品展示视频（保持用户原貌）。
- 漫感/2.5D 电子角色商品展示。
- 指定动作：站姿展示、走秀、转身、打招呼。
- 2–4 人共同入镜，各自保持角色与商品。
- 每条内容绑定 SKU、商品详情与门店入口。

### 四层控制（生产目标）

| 控制层 | 说明 | 检查项 |
|--------|------|--------|
| Identity Lock | 将用户照片转为可复用角色资产 | identityConsistency ≥ 0.80 |
| Garment Lock | 逐层锁定商品颜色/轮廓/Logo | garmentConsistency ≥ 0.72/层 |
| Motion Reference | 接收动作参考视频或姿态序列 | temporalConsistency ≥ 0.85 |
| Validation Gate | 审核/闪烁/穿模/身份检查 | moderationResult + traceId |

### 技术参考

代表性可接入方案（**非已集成，属于可替换 Provider**）：

- **LibTV / LiblibAI**：节点式多模态视频工作台、角色库与人像质感调节（https://www.liblib.art/）。
- **Seedream 5.0 Pro**：人物参考图生成、真实肤质、多参考图融合（https://seed.bytedance.com/en/seedream5_0_pro）。
- **Seedance 2.0**：接收人物图、商品图、动作视频、场景和镜头参考（https://seed.bytedance.com/en/blog/seedance-2-0-official-launch）。
- **私有 GPU Provider**：基于开源模型自建，用于成本、隐私和品牌定制。

详细技术路径见 [`动态试穿视频技术路径.md`](./动态试穿视频技术路径.md)。

## 生产请求示例

```json
{
  "identityId": "avatar_user_1024",
  "look": {
    "inner": "item-001",
    "outerwear": "item-011",
    "bottom": "item-029",
    "shoes": "item-005",
    "accessory": "item-010"
  },
  "episode": "2026-07-20-hangzhou-rooftop",
  "pose": "confident-main-character",
  "expression": "smile",
  "background": "lakeside-neon",
  "providerStage": "gateway-aigc-provider"
}
```

返回必须包含 `imageUrl`、`traceId`、`providerStage`、身份置信度、商品逐层一致性与 `fallbackReason`。

## 真实性与安全

- 当前图片明确标记为效果演示，不包装成生产级个性化输出。
- 原始身份照片默认不进入公开广场。
- 浏览器不直连私有 GPU，只访问 API Gateway。
- 凭据只保存在平台 Secret。
- Provider 失败必须显式降级并记录原因。
