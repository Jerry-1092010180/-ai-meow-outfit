# Avatar 平台设计 — 商业产品视角

> 面向银泰百货喵街 APP 的 Avatar 平台
> 不是建模软件，是服装商城的用户数字身份系统

---

## 一、Avatar 生命周期

```
       第一次建模
          │
     ┌────┴────┐
     │ 快速建模 │ (3 分钟完成，用于立即体验)
     └────┬────┘
          │
     ┌────┴────────────────────────────────────────────────────┐
     │                    永久 Avatar                          │
     │                                                        │
     │  avatar_id = 会员 ID (绑定永不解绑)                      │
     │  β 参数 = 身体数字指纹 (不会丢失)                        │
     │  纹理图 = 皮肤/面部 (可更新)                             │
     └────────────────────────────────────────────────────────┘
          │
     ┌────┼──────────────┬──────────────┬──────────────┐
     │    │              │              │              │
     ▼    ▼              ▼              ▼              ▼
  优化  换衣           分享            社交          推荐
     │    │              │              │              │
     │    │              │              │              │
     ▼    ▼              ▼              ▼              ▼
  历史版本  商城试穿     朋友圈          PK挑战         AI 穿搭
  (体重变化) (即看即买)   (海报分享)     (好友同框)     (天气/场合)
     │    │              │              │              │
     │    └──────────────┴──────────────┴──────────────┘
     │                        │
     ▼                        ▼
  数字资产                 商业变现
  (Avatar 持续增值)         (试穿→购买转化)

```

### 1.1 第一次建模（Onboarding）

**场景**：用户注册喵街会员 → 系统引导创建 Avatar。

**这里的核心设计原则：不能因为建模门槛就丢掉用户。**

所以 Avatar 创建应该有**三个入口**：

| 入口 | 耗时 | 精度 | 用户比例（预估） |
|------|------|------|-----------------|
| ① 快速创建：3 张照片 | 3 分钟 | 60% 像 | 70% 用户 |
| ② 标准创建：后置视频 | 10 分钟 | 85% 像 | 20% 用户 |
| ③ 专业创建：门店体测仪 | 15 分钟 | 95% 像 | 10% 用户 |

**关键决策**：用户完成入口①后，**立即获得永久 Avatar**。后续任何时候可以升级到入口②或③，β 参数和纹理自动替换，Avatar 身份不变。

### 1.2 永久 Avatar

**一旦创建，永不删除。**

| 数据项 | 可丢失？ | 原因 |
|--------|---------|------|
| avatar_id | ❌ 永远不能丢 | 绑定会员 ID，是身份锚点 |
| β 参数 | ❌ 永远不能丢 | 身体形状，重新建模成本极高 |
| 纹理图 | ✅ 可补拍 | 即使丢了一张脸，可以补拍正面照重建 |
| 测量值 | ✅ 可重新测量 | 身高体重可能有变化 |
| 原始照片 | ✅ 可删除以节省空间 | 已提取 β+纹理后即可清理 |

**β 参数的不可替代性**：假如数据库丢失 β，即使有一万张照片，也无法恢复出完全相同的身体形状。β 是 Avatar 的 DNA。

### 1.3 持续优化

Avatar 不是一次建模就结束的。每次用户与平台互动，都可以改进 Avatar。

**优化触发事件：**

```
体重变化 → 更新 β → 历史版本保留
重新拍照 → 更新纹理 → 历史版本保留
购买新衣 → 试穿记录 → 改进推荐算法
退货反馈 → 版型数据 → 改进尺码推荐
门店试穿 → 体测仪 → 升级到专业精度
```

**版本历史保留策略**：

```
v1: 2026-07-14  初始建模 (体重 58kg)
v2: 2026-12-20  体重更新 (体重 62kg, 纹理保留 v1)
v3: 2027-03-15  纹理更新 (发型变化, 形状保留 v2)
```

用户可以在时间轴上查看 Avatar 的变化，也可以恢复到任何历史版本。

---

## 二、商业价值转换路径

### 2.1 Avatar → 试穿 → 购买链路

```
用户登录 → 加载 Avatar
          ↓
AI 推荐今日穿搭 (天气 + 场合 + 用户历史)
          ↓
Avatar 穿上推荐服装 → 3D 展示
          ↓
满意？→ 加入购物车 → 选择尺码 (系统根据 β 参数推荐)
          ↓
不满意？→ 换一套
          ↓
购买 → 门店自提/快递 → 到店试穿 (对比 Avatar 效果)
```

**核心转化率杠杆**：
- 用户能看到"衣服穿在自己身上"的效果 → 购买意愿显著提升
- 系统知道用户的真实身体尺寸 → 尺码推荐准确率提高 → 退货率降低
- Avatar 可以"穿"门店所有库存 → 加购物车路径变短

### 2.2 Avatar → 分享 → 社交裂变

```
用户用 Avatar 搭配出一套穿搭
          ↓
生成 AI 海报 (Avatar + 服装 + 场景)
          ↓
分享到朋友圈 → 朋友看到 → 朋友也想试
          ↓
朋友创建自己的 Avatar → 新用户增长
```

**Avatar 的社交优势**：传统穿搭分享是"衣服好看"，Avatar 穿搭分享是"我穿这件衣服好看"。后者更有吸引力。

### 2.3 Avatar → AI 推荐 → 个性化

```
用户的 β 参数 → 身体形状 → 穿什么好看
用户的购买历史 → 风格偏好 → 喜欢什么
用户的试穿反馈 → 版型偏好 → 哪家品牌适合
          ↓
AI 推荐引擎每天推荐 3 套穿搭
(结合天气、季节、门店新品、用户风格)
```

---

## 三、数据库设计（什么数据保存什么）

### 3.1 核心表（永远不丢）

**avatars 表**（1:1 关联到用户）

```
avatar_id          UUID PK → 绑定喵街会员 ID
member_id          FK → 喵街会员主键 (唯一索引)
status             'active' | 'inactive' | 'archived'
created_at         timestamp
last_updated_at    timestamp
```

**avatar_bodies 表**（1:N 版本历史）

```
id                 UUID PK
avatar_id          FK
version            int (自增, 1, 2, 3...)
beta               JSON 数组 (100 个 float)  *** 最核心数据 ***
gender             'male' | 'female' | 'unknown'
height_cm          int
weight_kg          int
measurements       JSON { shoulder, bust, waist, hip, inseam }
body_type_label    'hourglass' | 'pear' | 'apple' | 'rectangle' | 'inverted_triangle'
capture_method     'photo' | 'video' | 'scanner' | 'manual'
capture_confidence float (0-1)
created_at         timestamp
note               '体重变化' | '重新建模' | '初始版本'
```

**avatar_appearances 表**（1:N 版本历史）

```
id                 UUID PK
avatar_id          FK
version            int (同步 body version)
texture_url        CDN URL (2048×2048 PNG)  *** 第二大核心数据 ***
hair_style_id      FK → hair_styles
skin_tone          'warm' | 'cool' | 'neutral'
eye_color          string
face_flame_params  JSON (DECA/MICA 输出的 100 个参数)
created_at         timestamp
```

### 3.2 业务表（商业价值）

**garments 表**（服装资产库）

```
garment_id         UUID PK
brand              string
store_id           FK → 银泰门店
category           'top' | 'bottom' | 'dress' | 'shoes' | 'accessory'
size_system        'S/M/L/XL' | 'CN_160_84' | etc.
price_cents        int
glb_url            CDN URL (三维服装模型)
smpl_size_params   JSON (该服装在 SMPL 上的拟合参数)
color              hex
fabric             string
created_at         timestamp
```

**wardrobes 表**（用户的虚拟衣橱）

```
id                 UUID PK
avatar_id          FK
garment_id         FK
added_at           timestamp
source             'purchase' | 'wishlist' | 'stylist_pick'
purchase_id        FK (如果是购买的)
```

**tryon_history 表**（AI 训练的核心数据源）

```
id                 UUID PK
avatar_id          FK
garment_id         FK
model_url          CDN URL (该用户在 CLO3D 中试穿的截图)
fit_score          int (用户评分 1-5)
purchased          boolean
returned           boolean
size_chosen        string
size_recommended   string (系统推荐的尺码)
created_at         timestamp
```

### 3.3 社交表

**outfits 表**（搭配集合）

```
outfit_id          UUID PK
avatar_id          FK
garment_ids        JSON [garment_id, ...]
occasion           'daily' | 'work' | 'party' | 'sport'
season             'spring' | 'summer' | 'autumn' | 'winter'
weather_tags       JSON ['sunny', '25°C']
is_public          boolean
share_count        int
created_at         timestamp
```

**shares 表**

```
id                 UUID PK
avatar_id          FK
outfit_id          FK
platform           'wechat_moments' | 'wechat_friend' | 'xiaohongshu'
poster_url         CDN URL (AI 生成的海报)
click_count        int
created_at         timestamp
```

---

## 四、哪些数据可用于 AI 训练

| 数据类型 | 训练价值 | 可用性 |
|---------|---------|--------|
| **β 参数 × 购买历史** | ⭐⭐⭐ | 最大。可用于训练"这种身材的人穿什么好看" |
| **β 参数 × 退货记录** | ⭐⭐⭐ | 可用于训练尺码推荐模型，降低退货率 |
| **纹理图（去标识化）** | ⭐⭐ | 可用于训练肤色/发型推荐模型，需脱敏 |
| **测量值 × 服装版型** | ⭐⭐⭐ | 可用于训练"这件衣服在 168cm/58kg 身上什么效果" |
| **试穿评分** | ⭐⭐⭐ | 用户标注了"好看/不好看"，是高质量训练数据 |
| **购买季节** | ⭐⭐ | 可用于训练季节性推荐 |
| **原始照片** | ⭐ | 隐私风险高，尽量不要存 |
| **社交分享** | ⭐⭐ | 可用于训练"什么穿搭会被分享" |
| **浏览路径** | ⭐ | 可用于训练推荐排序 |

**核心结论**：

- **β 参数 + 购买行为 = 平台最宝贵的 AI 资产**
- 它让银泰拥有其他电商没有的能力：基于真实人体形状的服装推荐
- 这是护城河

---

## 五、与当前项目的关系

当前项目（main 分支）是 MVP，实验分支是未来 2 年的产品规划。

| | main（当前 MVP） | experiment/avatar-v2（未来平台） |
|---|---|---|
| 核心数据 | CaptureFrame[] (8 张照片) | β (100 float) + 纹理图 URL |
| 存储 | 无后端，localStorage | PostgreSQL + CDN |
| 身份 | 无 | avatar_id = 会员 ID |
| 换衣 | 5 套预置 GLB，不换衣 | 独立服装资产库 |
| 分享 | Canvas 海报 | Avatar 3D 截图 + 社交链路 |
| AI 训练 | 无 | β × 购买 = 推荐引擎 |

---

## 六、产品原则

1. **Avatar 不是用户的一次性任务，而是用户与平台之间的关系。**
   - 用户来了就建，走了 Avatar 还在
   - 没买衣服时，Avatar 也在推荐

2. **β 参数是平台的核心资产，比纹理图更重要。**
   - 纹理丢了可以补拍
   - β 丢了用户必须重新建模，体验极差

3. **所有入口都要导向 Avatar 创建，但创建门槛逐级降低。**
   - 门店体测仪入口（首次到店）
   - 手机后置入口（朋友帮忙拍）
   - 快速 3 张照片入口（独⾃在家）

4. **Avatar 必须是平台的原生体验，不是外挂工具。**
   - 不是跳转到"建模页"再回来
   - 首页就看到自己的 Avatar
   - 每次天气推送 = Avatar 穿上今天的推荐穿搭

5. **不要在第一版追求完美。先跑通 β 参数管线，其他都可以迭代。**
