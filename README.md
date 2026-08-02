# AI喵搭

> 把今天想穿的，生成成今天的我。

**AI喵搭——懂真实商品的个人时尚角色生成器。**

一张本人照片、五件真实商品和一个今日场景，生成由用户本人主演、并且能够找到同款商品的时尚角色内容。

---

### 在线体验

**[next-gen-avatar.ai-meow-outfit.pages.dev/#/game](https://next-gen-avatar.ai-meow-outfit.pages.dev/#/game)**

📱 请使用手机浏览器打开 H5。

### One Pager（评审版）

**[AI喵搭-OnePager-评审版.pdf](deliverables/AI喵搭-OnePager-评审版.pdf)**（1 页 A4）

[![One Pager 预览](deliverables/judge-assets/onepager-preview.png)](deliverables/AI喵搭-OnePager-评审版.pdf)

---

## 30 秒看懂 AI喵搭

用户上传本人照片，建立可重复使用的个人角色身份；从真实商品池选择一套完整穿搭，再选择场景和视觉风格，生成"同一个我、同一套 Look"的时尚角色内容。结果可以继续调整动作、表情和背景，也可以与好友角色共同入镜。每张内容都能回到对应商品、价格、库存和门店入口。

---

## 用户体验流程

| 步骤 | 做什么 |
|------|--------|
| **1. 建立身份** | 上传本人照片，建立可复用的个人角色 |
| **2. 选择穿搭** | 从五类真实商品（内搭/外套/下装/鞋/配饰）各选一件 |
| **3. 生成与微调** | 调整动作、表情、发型、背景和镜头 |
| **4. 分享与购买** | 好友共同入镜、查看同款商品详情、查询门店 |

---

## 为什么 AI 是必要能力

普通搭配工具只能陈列商品，AI喵搭让**用户本人进入内容**：

- **身份保持**——个人角色可以跨场景、跨日期连续使用，而不是每次生成一个陌生人
- **商品保持**——生成内容中的服装能够回到真实 SKU，不是凭空想象的衣服
- **生成式内容**——每天新场景、新商品、新角色画面，形成回访和分享理由
- **AI 不是装饰**——AI 是核心内容生产能力，不是页面上的聊天框或推荐栏

---

## 当前可以验证什么

### ✅ 已经可运行（H5 现场体验）

- 手机 H5 完整交互流程
- 照片上传与角色身份建立
- 五层商品选择（内搭/外套/下装/鞋/配饰）
- 个人角色效果预览
- 动作、表情、背景等编辑
- 2—4 人共创房间
- 穿搭广场与商品回链

### 🔧 生产化接入（规划中，当前未接入）

- 更稳定的身份一致性
- 更严格的服装与商品一致性
- 真实银泰 PIM、价格、库存和门店接口
- 动态时尚短片生成（非当前版本功能）

---

## 真实性边界

- 当前 H5 交互、选装、角色编辑、邀请链接、多人房间和穿搭广场**均可运行**
- 角色生成图片和多人海报属于**效果演示**，生产版由 Gateway AIGC Provider 替换
- 当前商品图和价格/库存是**项目样例数据**，正式版接入银泰 PIM 与库存服务
- **动态视频尚未接入**，属于下一阶段扩展方向
- 私有 GPU 不向浏览器暴露，生产请求只经 API Gateway

---

## 评委快速体验路径

1. 📱 用手机浏览器打开 **[next-gen-avatar.ai-meow-outfit.pages.dev/#/game](https://next-gen-avatar.ai-meow-outfit.pages.dev/#/game)**
2. 👤 上传一张照片，体验角色身份建立
3. 👗 完成五层穿搭选择
4. 🎨 调整动作、表情和背景
5. 📖 打开 **[One Pager](deliverables/AI喵搭-OnePager-评审版.pdf)** 对照产品定义与边界

---

## 信息

- **赛题**：OPC 2026 · Bounty 03 · 银泰商业——为千万级会员设计 AI 原生喵街互动玩法
- **参赛方向**：创想家
- **阶段**：MVP / 原型（可运行 H5）
- **团队**：单人参赛 · AI 辅助开发
- **许可证**：MIT

---

<details>
<summary>🔧 技术栈与本地运行</summary>

### 技术架构

React 18 + TypeScript + Vite 6 · Three.js (React Three Fiber) · Zustand · Canvas API · Cloudflare Pages · Tailscale + 4090D GPU (AIGC 私有算力)

### 本地运行

```bash
npm install
npm run dev
```

生产构建：

```bash
npm run build
npx wrangler pages deploy dist --project-name=ai-meow-outfit
```

</details>
