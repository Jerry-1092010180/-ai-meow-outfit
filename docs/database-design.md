# Avatar 平台数据库设计

---

## 一、ER 图（文本表示）

```
┌──────────────┐
│    User      │
├──────────────┤
│ user_id (PK) │────┐
│ phone        │    │ 1:1
│ wechat_openid│    │
│ created_at   │    │
│ status       │    │
└──────────────┘    │
                    │
┌───────────────────┘
│
│ 1:1
│
┌───────────────────┐
│     Avatar        │
├───────────────────┤
│ avatar_id (PK)    │────── 1:N ──────┐
│ user_id (FK,UQ)   │                │
│ status            │                │
│ active_body_id(FK)│                │
│ active_face_id(FK)│                │
│ active_hair_id(FK)│                │
│ active_meas_id(FK)│                │
│ created_at        │                │
│ last_active_at    │                │
└───────────────────┘                │
      │ 1:N                          │
      │                              │
      ▼                              ▼
┌──────────────────┐    ┌───────────────────┐
│ CaptureSession   │    │  BodyParameter    │
├──────────────────┤    ├───────────────────┤
│ session_id (PK)  │    │ body_id (PK)      │
│ avatar_id (FK)   │    │ avatar_id (FK)    │
│ method           │    │ version           │
│ device           │    │ beta (100 floats) │
│ lighting_quality │    │ gender            │
│ avg_quality      │    │ height_cm         │
│ created_at       │    │ weight_kg         │
└──────────────────┘    │ confidence        │
      │ 1:N             │ created_at        │
      │                 │ note              │
      ▼                 └───────────────────┘
┌──────────────────┐
│     Image        │
├──────────────────┤
│ image_id (PK)    │
│ session_id (FK)  │
│ angle            │ ── 0/45/90/135/180/225/270/315
│ image_type       │ ── raw / mask / cropped
│ file_url         │
│ width            │
│ height           │
│ quality_score    │
│ created_at       │
└──────────────────┘

┌───────────────────┐        ┌───────────────────┐
│      Face         │        │      Hair         │
├───────────────────┤        ├───────────────────┤
│ face_id (PK)      │        │ hair_id (PK)      │
│ avatar_id (FK)    │        │ avatar_id (FK)    │
│ version           │        │ version           │
│ flame_params      │        │ hairstyle_id (FK) │─→ preset hairstyles
│ texture_url       │        │ color_hex         │
│ created_at        │        │ length_cm         │
│ note              │        │ created_at        │
└───────────────────┘        └───────────────────┘

┌───────────────────┐
│  Measurements     │
├───────────────────┤
│ meas_id (PK)      │
│ avatar_id (FK)    │
│ version           │
│ shoulder_cm       │
│ bust_cm           │
│ waist_cm          │
│ hip_cm            │
│ inseam_cm         │
│ neck_cm           │
│ arm_length_cm     │
│ leg_length_cm     │
│ source            │ ── scanner / measurement / estimation
│ created_at        │
└───────────────────┘

     ┌────────────────────┐
     │    Garment         │ ──── 平台资产库，不绑定用户
     ├────────────────────┤
     │ garment_id (PK)    │
     │ brand              │
     │ store_id (FK)      │ ── 银泰门店
     │ category           │ ── top/bottom/dress/shoes/accessory
     │ name               │
     │ price_cents        │
     │ sizes_available    │ ── ['S','M','L','XL']
     │ glb_url            │ ── CLO3D 生成的数字服装
     │ glb_size_M         │ ── M 号的 GLB
     │ glb_size_L         │ ── L 号的 GLB
     │ color_hex          │
     │ fabric             │
     │ tags               │ ── ['通勤','约会','运动']
     │ status             │ ── active / inactive
     │ created_at         │
     └────────────────────┘
              │
              │ 1:N
              ▼
     ┌────────────────────┐
     │    OutfitItem      │ ──── 一件衣服在一个搭配中
     ├────────────────────┤
     │ outfit_id (FK)     │
     │ garment_id (FK)    │
     │ position           │ ── 穿搭顺序（排序用）
     └────────────────────┘
              ▲
              │ N:1
     ┌────────────────────┐
     │     Outfit         │ ──── 用户的穿搭搭配
     ├────────────────────┤
     │ outfit_id (PK)     │
     │ avatar_id (FK)     │
     │ name               │
     │ occasion           │
     │ season             │
     │ is_public          │
     │ created_at         │
     └────────────────────┘

     ┌────────────────────┐
     │   TryOnHistory     │ ──── AI 训练核心数据
     ├────────────────────┤
     │ tryon_id (PK)      │
     │ avatar_id (FK)     │ ──── 哪个身体的试穿
     │ body_id (FK)       │ ──── 当时使用的 body 版本
     │ garment_id (FK)    │
     │ size_chosen        │
     │ size_recommended   │
     │ fit_score          │ ──── 用户评分 1-5 (关键训练数据)
     │ purchased          │
     │ returned           │
     │ cart_added         │
     │ session_id         │ ──── 浏览器会话
     │ created_at         │
     └────────────────────┘

     ┌────────────────────┐
     │      Share         │
     ├────────────────────┤
     │ share_id (PK)      │
     │ avatar_id (FK)     │
     │ outfit_id (FK)     │
     │ platform           │
     │ poster_url         │
     │ click_count        │
     │ created_at         │
     └────────────────────┘

     ┌────────────────────┐
     │    Animation       │ ──── 预设动画库
     ├────────────────────┤
     │ anim_id (PK)       │
     │ name               │
     │ pose_sequence      │ ──── 关键帧 θ 参数序列
     │ duration_seconds   │
     │ loop               │
     │ created_at         │
     └────────────────────┘
```

---

## 二、每张表详细说明

### 1. `users` — 用户账户

**这是平台的根基。** 不可删除，不可合并。

| 字段 | 类型 | 说明 |
|------|------|------|
| user_id | UUID PK | 内部标识 |
| phone | VARCHAR(20) UNIQUE | 手机号注册 |
| wechat_openid | VARCHAR(64) UNIQUE | 微信登录 |
| miaojie_member_id | VARCHAR(32) UNIQUE | 喵街会员 ID |
| nickname | VARCHAR(64) | |
| avatar_png_url | VARCHAR(512) | 2D 头像（缩略图） |
| created_at | TIMESTAMP | |
| status | ENUM('active','frozen','deleted') | 冻结（长期未登录）或删除（仅标记，不删数据） |

**为什么这样设计**：
- user 和 avatar 分开，因为 user 可以删除但 avatar 可能被其他用户引用（分享记录、PK 记录）
- miaojie_member_id 是银泰系唯一的身份锚点
- 三个登录方式（手机、微信、会员号）都是唯一键

**扩展**：后续添加 email 登录、支付宝登录时加 unique 字段即可。

---

### 2. `avatars` — 数字分身

**用户身份和数字身分之间的桥梁。** 持有活跃版本的指针。

| 字段 | 类型 | 说明 |
|------|------|------|
| avatar_id | UUID PK | Avatar 唯一标识 |
| user_id | UUID FK UNIQUE | 一对一绑定 |
| status | ENUM('creating','active','inactive') | creating=正在建模 |
| active_body_id | UUID FK→body_params | 当前活跃的身体参数 |
| active_face_id | UUID FK→faces | 当前活跃的面部 |
| active_hair_id | UUID FK→hairs | 当前活跃的发型 |
| active_meas_id | UUID FK→measurements | 当前活跃的测量值 |
| created_at | TIMESTAMP | |
| last_active_at | TIMESTAMP | 最后活跃时间 |

**为什么这样设计**：
- Status `creating` 允许用户还没完成建模就开始使用其他功能（浏览门店）
- 四个 FK 指向不同维度表的活跃版本，每个维度独立版本控制
- 这样用户减肥只更新 body 和 measurements，face/hair 不动

**扩展**：后期可以加 `active_outfit_id`（记住用户上次穿的搭配）。

---

### 3. `body_parameters` — 身体参数（核心资产）

**这是平台最核心的数据。** β 参数就是 avatars 的 DNA。

| 字段 | 类型 | 说明 |
|------|------|------|
| body_id | UUID PK | |
| avatar_id | UUID FK | 1:N 关系 |
| version | INT | 版本号递增 |
| beta | JSONB | SMPL 100 维向量，存为 JSON 数组 |
| gender | ENUM('male','female','unknown') | |
| height_cm | NUMERIC(5,1) | |
| weight_kg | NUMERIC(5,1) | |
| confidence | NUMERIC(3,2) | 拟合置信度 |
| capture_session_id | UUID FK→capture_sessions | 来自哪次采集 |
| created_at | TIMESTAMP | |
| note | VARCHAR(128) | 中文备注：'初始建模','体重变化' |

**为什么这样设计**：
- 1:N 而不是 1:1，因为用户可能有多个版本
- beta 是 100 浮点数的 JSON，既可用作数据库查询（JSONB）也可直接传给算法模型
- capture_session_id 追踪数据来源，用于质量审计
- note 给用户展示时间线："您的体型在 2026-12 更新过"

**扩展**：后期可以添加 `source_model` 字段（'SMPLify-X' / 'ECON' / 'CLIFF'），用来追踪不同拟合版本的差异。

---

### 4. `faces` — 面部参数

| 字段 | 类型 | 说明 |
|------|------|------|
| face_id | UUID PK | |
| avatar_id | UUID FK | |
| version | INT | |
| flame_params | JSONB | DECA/MICA 输出的 ~100 参数 |
| texture_url | VARCHAR(512) | CDN 上的面部纹理图 |
| created_at | TIMESTAMP | |
| note | VARCHAR(128) | |

**为什么分开**：身体参数更新（减肥）时，面部纹理通常不需要改。分开存储避免了冗余。

---

### 5. `hairs` — 发型

| 字段 | 类型 | 说明 |
|------|------|------|
| hair_id | UUID PK | |
| avatar_id | UUID FK | |
| version | INT | |
| hairstyle_id | INT FK→preset_hairstyles | 预设发型 ID |
| color_hex | VARCHAR(7) | '#2D1B0E' |
| length_cm | NUMERIC(3,1) | |
| created_at | TIMESTAMP | |

**为什么分开**：发型是独立于身体和面部的维度。用户换发型不应该影响脸和身体。

**扩展**：后期可以接 NeuralHaircut 自动生成真实发型，只需添加 `mesh_url` 和 `self_occlusion_map` 字段。

---

### 6. `measurements` — 身体测量值

| 字段 | 类型 | 说明 |
|------|------|------|
| meas_id | UUID PK | |
| avatar_id | UUID FK | |
| version | INT | |
| shoulder_cm | NUMERIC(4,1) | |
| bust_cm | NUMERIC(4,1) | |
| waist_cm | NUMERIC(4,1) | |
| hip_cm | NUMERIC(4,1) | |
| inseam_cm | NUMERIC(4,1) | |
| neck_cm | NUMERIC(3,1) | |
| arm_length_cm | NUMERIC(4,1) | |
| leg_length_cm | NUMERIC(4,1) | |
| source | ENUM('scanner','measurement','estimation') | |
| created_at | TIMESTAMP | |

**为什么和 body_parameters 分开**：β 参数是 SMPL 模型的抽象表示，测量值是传统的厘米值。两者用途不同：
- β 用于 3D 展示和服装拟合
- 测量值用于尺码推荐和退货预测
- β 可以从 SMPL 反推出测量值，但反之不行

**扩展**：后续品牌需要特定测量值（如裤长、袖长），直接加字段即可。

---

### 7. `capture_sessions` — 采集会话

| 字段 | 类型 | 说明 |
|------|------|------|
| session_id | UUID PK | |
| avatar_id | UUID FK | |
| method | ENUM('photo_3','photo_8','video_30s','scanner') | |
| device | VARCHAR(64) | 设备型号 |
| lighting_quality | ENUM('good','medium','poor') | |
| avg_quality | NUMERIC(3,2) | |
| image_count | INT | |
| created_at | TIMESTAMP | |

**为什么这样设计**：一次采集产生多张图片，需要用 session 来分组。session 记录整体质量，用于后续审计哪些采集方式效果最好。

---

### 8. `images` — 采集图片

| 字段 | 类型 | 说明 |
|------|------|------|
| image_id | UUID PK | |
| session_id | UUID FK | |
| angle | INT | 0/45/90/135/180/225/270/315 |
| image_type | ENUM('raw','mask','cropped') | |
| file_url | VARCHAR(512) | CDN URL |
| width | INT | |
| height | INT | |
| quality_score | NUMERIC(3,2) | |
| created_at | TIMESTAMP | |

**为什么这样设计**：一张原始照片对应三种处理态（raw/mask/cropped），需要记录各自 URL。

**为什么不允许删除（软删除都不行）**：
- 图片用于未来更好的重建模型重新训练
- 如果 2 年后出现了更好的重建算法，可以拿原始图片重新跑
- 隐私合规需要时可以物理删除，但不应是产品功能

---

### 9. `garments` — 服装资产

| 字段 | 类型 | 说明 |
|------|------|------|
| garment_id | UUID PK | |
| brand | VARCHAR(64) | |
| store_id | UUID FK | 银泰门店 |
| category | ENUM('top','bottom','dress','shoes','accessory') | |
| name | VARCHAR(128) | |
| description | TEXT | |
| price_cents | INT | |
| sizes_available | JSONB | ['S','M','L','XL'] |
| glb_url | VARCHAR(512) | 数字服装 GLB |
| glb_size_m | VARCHAR(512) | M 号 GLB |
| glb_size_l | VARCHAR(512) | L 号 GLB |
| color_hex | VARCHAR(7) | |
| fabric | VARCHAR(32) | |
| tags | JSONB | ['通勤','夏日','简约'] |
| status | ENUM('active','inactive','draft') | |
| created_at | TIMESTAMP | |

**为什么这样设计**：garments 是共享资产，不属于任何用户。一份 GLB 供所有用户试穿。

**不同尺码的 GLB**：服装在不同尺码下的 3D 模型是不同的（S 号和 XL 号的版型不一样）。推荐策略是品牌方提供 2-3 个尺码的 GLB，其他尺码由算法插值。

**扩展**：后续可以加 `color_variants`（同款不同色）、`pattern_url`（图案贴图）、`sustainability_score`（环保评分）等字段。

---

### 10. `outfits` + `outfit_items` — 穿搭搭配

**outfits**:

| 字段 | 类型 | 说明 |
|------|------|------|
| outfit_id | UUID PK | |
| avatar_id | UUID FK | |
| name | VARCHAR(64) | '夏日通勤穿搭' |
| occasion | VARCHAR(32) | 'daily'/'work'/'party'/'sport' |
| season | VARCHAR(16) | 'spring'/'summer'/'autumn'/'winter' |
| is_public | BOOLEAN | |
| created_at | TIMESTAMP | |

**outfit_items**:

| 字段 | 类型 | 说明 |
|------|------|------|
| outfit_id | UUID FK | |
| garment_id | UUID FK | |
| position | INT | 排序（上衣→下装→鞋） |

**为什么拆分两张表**：一个 outfit 包含多件 garment，多对多关系需要中间表。这允许同一件衣服出现在多个搭配中。

---

### 11. `try_on_history` — AI 训练的核心

| 字段 | 类型 | 说明 |
|------|------|------|
| tryon_id | UUID PK | |
| avatar_id | UUID FK | 谁 |
| body_id | UUID FK→body_parameters | 当时的身形 |
| garment_id | UUID FK | 哪件衣服 |
| size_chosen | VARCHAR(8) | 用户选的尺码 |
| size_recommended | VARCHAR(8) | 系统推荐的尺码 |
| fit_score | INT | 1-5 评分（**关键**） |
| purchased | BOOLEAN | |
| returned | BOOLEAN | |
| cart_added | BOOLEAN | |
| session_id | VARCHAR(64) | 浏览器会话（分析转化率） |
| created_at | TIMESTAMP | |

**为什么这样设计**：这是整个平台最具 AI 训练价值的表。核心在于：

```
β × garment → fit_score + purchased + returned

训练目标：
- "什么样的 body 穿这件衣服好看"（fit_score 预测）
- "这个 body 应该穿什么尺码"（size 推荐）
- "这个 body 买了这件衣服会不会退货"（return 预测）
```

**为什么记录 body_id 而不只是 avatar_id**：因为 avatar 的版体可能变化。如果 v1 和 v2 的 β 不同，试穿结果也不同。body_id 记录了当时的准确状态。

**为什么记录 session_id**：用于分析转化路径（浏览→试穿→加购→购买），评估 Avatar 对购买决策的影响。

---

### 12. `shares` — 社交分享

| 字段 | 类型 | 说明 |
|------|------|------|
| share_id | UUID PK | |
| avatar_id | UUID FK | 谁分享的 |
| outfit_id | UUID FK | 分享的哪个搭配 |
| platform | ENUM('wechat_moments','wechat_friend','xiaohongshu','copy_link') | |
| poster_url | VARCHAR(512) | AI 生成海报 |
| click_count | INT | |
| created_at | TIMESTAMP | |

**为什么这样设计**：click_count 是传播效率的直接度量。可以通过分析"哪个 outfit 被分享最多"来优化 AI 推荐和服装陈列。

---

### 13. `animations` — 预设动画

| 字段 | 类型 | 说明 |
|------|------|------|
| anim_id | UUID PK | |
| name | VARCHAR(32) | 'walk','turn','catwalk','tpose' |
| pose_sequence | JSONB | 关键帧 θ 序列 |
| duration_seconds | NUMERIC(4,2) | |
| loop | BOOLEAN | |
| created_at | TIMESTAMP | |

**为什么独立建表**：动画属于平台资产，不属于用户。所有 Avatar 使用同一套动画（因为 SMPL 骨架相同）。一个 Avatar 可以播放任何动画。

---

## 三、索引策略

```
users:
  UNIQUE(phone), UNIQUE(wechat_openid), UNIQUE(miaojie_member_id)

avatars:
  UNIQUE(user_id)
  INDEX(status)  ← 筛选活跃用户做推送

body_parameters:
  INDEX(avatar_id, version)  ← 查询某个 avatar 的所有版本
  UNIQUE(avatar_id, version) ← 防止重复版本号

try_on_history:
  INDEX(avatar_id, created_at)     ← 用户最近的试穿记录
  INDEX(garment_id)                ← 某件衣服被谁试过
  INDEX(body_id, garment_id)       ← AI 训练查询
  INDEX(fit_score)                 ← 高质量评分筛选
```

---

## 四、预估存储量

| 表 | 行数（3 年） | 单行大小 | 总大小 |
|----|-----------|---------|-------|
| users | 50M | 256 B | 12 GB |
| avatars | 50M | 128 B | 6 GB |
| body_parameters | 75M | 512 B | 36 GB |
| faces | 50M | 1 KB | 48 GB |
| hairs | 55M | 128 B | 7 GB |
| measurements | 75M | 256 B | 18 GB |
| capture_sessions | 50M | 128 B | 6 GB |
| images | 600M | 256 B | 150 GB |
| garments | 100K | 1 KB | 100 MB |
| outfits + items | 200M | 256 B | 48 GB |
| try_on_history | 500M | 256 B | 120 GB |
| shares | 200M | 256 B | 48 GB |
| animations | 20 | 256 B | < 1 MB |
| **总计** | | | **~500 GB** |

**注释**：
- images 不包含实际图片文件（存在 CDN），只记录元数据
- try_on_history 是增速最快的表，因为用户每次换衣操作都产生一条记录
- 500 GB 在 PostgreSQL 上单机可处理（正确索引后），分库分表不需要在 3 年内考虑

---

## 五、未来扩展预留

### 5.1 多 Avatar

当前设计 avatar:user = 1:1。后期如果用户想创建多个 Avatar（比如一个日常版一个正式场合版），只需移除 UNIQUE(user_id) 约束：

```
avatars:
  UNIQUE(user_id) → INDEX(user_id)  ← 简单修改
```

### 5.2 AR 试穿

如果需要 AR 试穿，只需在 garments 表的 glb_url 旁添加 ar_model_url 字段。不需要改表结构。

### 5.3 AI 推荐模型

训练推荐模型所需的特征向量可以添加在 users 表：

```
users:
  feature_vector JSONB  ← 用户偏好向量（256 浮点数）
```

也可以建独立的特征表：

```
user_recommendation_features:
  user_id FK
  feature_vector JSONB
  model_version VARCHAR(16)
  updated_at TIMESTAMP
```

### 5.4 服装预购

如果服装还没进店，用户可以预购。可以复用 garments 表，只需加状态字段：

```
garments:
  status ENUM('preorder','active','inactive','discontinued')
  preorder_release_date TIMESTAMP
```

### 5.5 用户生成 Avatar 资产

如果允许用户将自己的数字服装上架（C2C），可以使用同一张 garments 表，只需添加 owner_id：

```
garments:
  owner_id UUID FK→users  ← 用户上传的服装
  license ENUM('public','private','brand')  ← 使用范围
```
