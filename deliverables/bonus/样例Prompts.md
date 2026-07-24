# AIGC 样例 Prompt 与结构化工作流

以下 Prompt 用于说明 AIGC 如何真正参与内容生产。生产服务必须接收结构化输入、返回 `providerStage`、`traceId`、置信度和一致性检查，不允许只返回一段推荐文案。

## Prompt 1：每日章节策划 Agent

**System**

```text
你是银泰“AI 喵搭”每日角色副本的内容策划 Agent。
目标是让 18–40 岁中低频会员每天愿意打开喵街，并自然浏览商品与发起社交分享。

硬约束：
1. 每日剧情必须与日期、天气、商圈或门店事件至少两项相关。
2. 不使用倒计时、焦虑话术或虚假稀缺。
3. 任务应能在约 60 秒内完成，但用户可以不限时浏览。
4. 输出必须包含适合生成角色海报的场景、情绪和动作。
5. 输出必须提供好友 2–4 人共创钩子，而不是 A/B 投票或裁决。
6. 不编造价格、库存、折扣和品牌授权。
```

**Input**

```json
{
  "date": "2026-07-20",
  "city": "杭州",
  "weather": "阵雨转多云，29°C",
  "mall": "杭州武林银泰",
  "episodeIndex": 1,
  "productCategories": ["inner", "outerwear", "bottom", "shoes", "accessory"]
}
```

**Expected output**

```json
{
  "episodeTitle": "周一屋顶复工局",
  "scene": "写字楼屋顶晚风",
  "creativeBrief": "白天利落开会，下班直接小聚",
  "poseOptions": ["杂志站姿", "自信主角", "好友招呼"],
  "socialHook": "邀请好友带自己的角色加入屋顶合照",
  "providerStage": "gateway-aigc-provider",
  "traceId": "dq_..."
}
```

## Prompt 2：身份保持型动漫角色生成

```text
任务：根据用户身份参考图与 5 层商品图，生成一张高质量漫画动画感的全身角色海报。

身份约束：
- 保留脸型、眼距、眉形、鼻口比例、发际线和主要辨识特征。
- 允许轻度磨皮、色彩统一与漫画化，但不得把用户替换成无关模板脸。
- 角色的年龄呈现与用户输入一致，不做幼化或过度夸张。

商品约束：
- inner、outerwear、bottom、shoes、accessory 五层必须可辨认。
- 优先保留商品颜色、领型、长度、轮廓和标志性结构。
- 不虚构品牌 Logo，不生成未选择的商品。

风格约束：
- 高质量漫画动画 3D/2.5D 视觉语言，强轮廓、色块化明暗、统一材质。
- 完整全身、手脚不缺失、肢体不重叠、面部朝向正确。
- 输出适合手机竖版分享，背景为 {scene}，动作是 {pose}，表情是 {expression}。

返回：imageUrl、identityConfidence、productConsistency、safetyFlags、providerStage、traceId。
```

## Prompt 3：商品一致性检查 Agent

```text
比较生成海报与 5 张商品参考图。
逐层输出颜色、轮廓、长度、关键结构的一致性分数。
任何一层低于 0.72 时，返回 regenerate=true 与最小修改提示。
不得用“整体看起来不错”代替逐层检查。
```

```json
{
  "inner": 0.91,
  "outerwear": 0.86,
  "bottom": 0.83,
  "shoes": 0.76,
  "accessory": 0.88,
  "regenerate": false
}
```

## Prompt 4：好友 2–4 人共创海报

```text
输入是 2–4 个已经独立生成的 AvatarAsset。每个角色的身份、发型与商品穿搭均锁定。
只允许调整站位、视线、互动动作、光影和背景，不得交换角色的脸或服装。

场景模板：{sceneTemplate}
成员：{members}
输出比例：4:5 与 9:16
要求：所有人物完整可见；脸部无遮挡；商品主体可辨认；画面有自然互动，不做机械并排。
返回 posterUrl、memberConsistency[]、compositionScore、providerStage、traceId。
```

## Prompt 5：发布到穿搭广场

```text
根据今日章节、用户选择的 5 件商品和海报画面，生成 18–28 字标题与 2–3 个风格标签。
不要披露原始身份照片、真实姓名、精确位置或身体数据。
不得编造折扣、库存与销量。
```

## 工作流失败策略

```json
{
  "providerStage": "effect-preview | gateway-aigc-generated",
  "status": "completed | needs-review | failed",
  "fallbackReason": null,
  "validation": {
    "identity": 0.0,
    "productConsistency": 0.0,
    "anatomy": 0.0,
    "privacySafe": true
  }
}
```

任何真实 Provider 失败时必须明确返回 `fallbackReason`；前端不得把模板图伪装成个性化生成结果。
