# Claude Code GitHub 同步与文档更新指南

生成时间：2026-07-16  
项目目录：`/Users/jerry/Documents/Codex/ai-meow-outfit`

## 你的任务

把当前本地 `next-gen-avatar` 分支最近完成、但尚未完整同步到 GitHub
的工作安全提交到正确位置，并更新已经过时的项目上下文文档。

这不是重新开发功能的任务。先核验、补文档、验证，再推送。

## 强制限制

1. 只能在 `next-gen-avatar` 分支工作。
2. 不要修改、合并或推送 `main`。
3. 不要 force push。
4. 不要重写、squash 或 amend 已存在的功能提交。
5. 不要删除用户已有文件或回滚其他历史改动。
6. 不要把 `.env`、Token、Cookie、Cloudflare Secret、SSH 凭据或
   AIGC 私网凭据加入 Git。
7. 除非 GitHub 工作流强制要求，否则不要创建 PR。

## 当前 Git 真实状态

仓库：

```text
https://github.com/Jerry-1092010180/-ai-meow-outfit.git
```

目标分支：

```text
next-gen-avatar
```

生成本指南前的状态：

```text
Local HEAD:
c707a53ee34fb662bc8b1ad31c57caf1d82fb2de

origin/next-gen-avatar:
bf1e764bc5273d415368af9054432eb19eb23eeb

Ahead:
1 commit
```

本地尚未推送的功能提交：

```text
c707a53 feat(game): refine intuitive outfit selection and public look plaza
```

之前两次推送失败的原因分别是：

```text
Error in the HTTP2 framing layer
Empty reply from server
```

这属于 GitHub 网络连接异常，不是 non-fast-forward、权限错误或认证失败。

本指南文件 `TO_CLAUDE_CODE.md` 是在 `c707a53` 之后新建的文件。Claude
开始工作时应先用 `git status` 确认它是否仍为未跟踪文件。

## 最近已经完成的功能

### 1. 多人好友共创

提交 `bf1e764` 已经存在于远端，包含：

- 好友不再进行 A/B 裁决。
- 每位好友上传自己的照片、选择自己的完整穿搭并生成独立角色。
- 同一个邀请链接可连续加入最多 4 人。
- 支持 `1/4` 到 `4/4` 的房间席位。
- 支持并肩、击掌、走秀和合照自拍互动模板。
- 支持双人、三人、四人海报构图。
- 新增个人角色社交展示板。
- 新增 `SocialSceneInvite`、`SocialSceneSession`。
- 新增 `SocialScenePlatformProvider`。
- Demo 使用 `localStorage` 保存房间会话。
- 生产环境预留 API Gateway 多人房间接口。

核心文件：

```text
src/types/socialAvatar.ts
src/services/socialAvatarImageProvider.ts
src/services/socialScenePlatformProvider.ts
src/pages/DailyQuestPage.tsx
docs/SOCIAL_AVATAR_IMAGE_PIPELINE.md
```

### 2. 尚未推送的选衣体验和穿搭广场

提交 `c707a53` 包含：

- 商品选择卡以大幅实拍图片为主。
- 点击整张商品卡只负责选中，不再直接打开详情。
- 选中后卡片向右下下沉并移除阴影。
- 只有卡片下方的“查看详情”按钮能打开商品详情。
- 新增底部“确认这件”按钮，确认后才进入下一类商品。
- 完全移除选择阶段倒计时和超时自动提交。
- 页面只提示“约 60 秒完成 · 不限时”。
- 新增“银泰穿搭广场”，展示用户主动公开的穿搭海报。
- 生成结果新增公开开关，默认关闭。
- 公开内容不包含用户原始身份照片。
- 新增 `daily_quest_publication_toggle` 埋点。

涉及文件：

```text
src/pages/DailyQuestPage.tsx
src/services/dailyQuestAigcProvider.ts
src/types/dailyQuest.ts
src/utils/analytics.ts
docs/SOCIAL_AVATAR_IMAGE_PIPELINE.md
```

## 当前产品真相

当前比赛主入口是：

```text
/#/game
```

当前正确主链路是：

```text
每日场景和银泰商品池
  -> 用户上传身份照片
  -> 依次选择内搭、外套、下装/连衣裙、鞋履、配饰
  -> 不限时确认完整穿搭
  -> AIGC 生成个人动漫角色海报
  -> 用户可编辑发型、表情、动作和背景
  -> 用户可选择是否公开到银泰穿搭广场
  -> 邀请好友生成各自角色
  -> 组成 2—4 人互动海报
  -> 分享、到店任务和试穿券
```

好友链接使用：

```text
/#/game?join=<sceneId>&max=4&host=<productIds>
```

不要恢复以下旧机制：

- `?assist=<code>`
- A/B 穿搭裁决
- 好友替房主投票
- 60 秒强制倒计时
- 超时自动选择商品
- 把木乃伊人体、silhouette carving 或程序化圆柱人体作为比赛主体验

## 必须更新的过时文档

### `CONTEXT.md`

该文件仍错误描述：

- “60 秒三轮商品选择”
- “好友 A/B 最终裁决”
- `/#/game?assist=<code>`
- 倒计时是日开钩子

请改成当前的五层完整穿搭、不限时选择、独立好友角色、多人房间和穿搭广场。

保留以下正确原则：

- 商业目标优先于人体建模技术。
- AIGC 必须实际生成角色、动作或社交内容。
- 私有 AIGC 必须经过 API Gateway。
- 开发只在 `next-gen-avatar`。

### `TO_CODEX.md`

该文件大部分内容仍围绕旧摄像头、8 角度人体采集、Body Detection 和
silhouette carving。请增加醒目的“历史上下文”标记，并把当前比赛主路径
更新为 `/#/game` 的每日 AI 穿搭与好友共创玩法。

不要删除旧技术资料，但必须明确：

```text
TryOn / legacy reconstruction = 历史兼容或实验入口
DailyQuestPage / social avatar image pipeline = 当前比赛主入口
```

同时删除或改写“每次只修一个 Bug，提交后等待 Review”的旧限制。当前项目
采用连续完成、统一验证的开发方式。

## 建议提交结构

不要修改已存在的 `c707a53`。

先更新 `CONTEXT.md`、`TO_CODEX.md`，并把本指南加入文档提交：

```bash
git add CONTEXT.md TO_CODEX.md TO_CLAUDE_CODE.md
git commit -m "docs: refresh competition game and social avatar context"
```

这样最终会有两个待推送提交：

```text
c707a53 feat(game): refine intuitive outfit selection and public look plaza
<new hash> docs: refresh competition game and social avatar context
```

## 操作步骤

### 1. 核验目录、分支和远端

```bash
cd /Users/jerry/Documents/Codex/ai-meow-outfit
git branch --show-current
git status --short --branch
git remote -v
git remote get-url origin
```

必须确认：

```text
branch = next-gen-avatar
origin = https://github.com/Jerry-1092010180/-ai-meow-outfit.git
```

### 2. 获取远端真实状态

```bash
git fetch origin --prune --tags
git log --oneline --decorate -6
git rev-list --left-right --count origin/next-gen-avatar...next-gen-avatar
git ls-remote --heads origin refs/heads/main refs/heads/next-gen-avatar
```

如果远端仍为 `bf1e764`，按本指南继续。

如果远端已出现其他人的新提交：

- 不要 force push。
- 先完成并提交文档改动。
- 执行 `git pull --rebase origin next-gen-avatar`。
- 仔细解决冲突并重新验证。

### 3. 更新过时文档

只更新：

```text
CONTEXT.md
TO_CODEX.md
TO_CLAUDE_CODE.md
```

不要顺手重构业务代码。

### 4. 运行验证

```bash
npm run build
npx oxlint --ignore-pattern 'public/vendor/**' --quiet
git diff --check
```

预期：

- TypeScript 和 Vite 构建通过。
- oxlint 零错误。
- `git diff --check` 无输出。
- Vite 可能提示 Three.js 相关 chunk 大于 500 kB，这是已有性能警告，
  不是本次提交阻塞项。

可选本地验收：

```bash
npm run dev -- --host 127.0.0.1 --port 5174
```

打开：

```text
http://127.0.0.1:5174/#/game
```

检查：

1. 首页显示“约 60 秒完成 · 不限时”。
2. 首页能看到“银泰穿搭广场”。
3. 点击商品大图只产生选中下沉效果。
4. 点击“查看详情”才打开详情弹层。
5. 点击“确认这件”才进入下一商品类别。
6. 结果页可选择是否公开到穿搭广场。
7. “共创”页签支持最多 4 人和四种互动模板。

### 5. 提交文档

```bash
git add CONTEXT.md TO_CODEX.md TO_CLAUDE_CODE.md
git commit -m "docs: refresh competition game and social avatar context"
```

提交前再次检查：

```bash
git status --short
git diff --cached --check
git diff --cached --stat
```

### 6. 推送正确分支

```bash
git push origin next-gen-avatar
```

如果出现 HTTP/2 framing 错误，可以重试：

```bash
git -c http.version=HTTP/1.1 push origin next-gen-avatar
```

不要使用：

```bash
git push --force
git push origin main
git merge next-gen-avatar
```

### 7. 验证 GitHub 服务端

```bash
git fetch origin --prune
git status --short --branch
git rev-parse HEAD
git rev-parse origin/next-gen-avatar
git merge-base --is-ancestor c707a53 origin/next-gen-avatar
git ls-remote --heads origin refs/heads/next-gen-avatar
```

最终必须满足：

- `HEAD` 与 `origin/next-gen-avatar` 一致。
- 工作区 clean。
- `c707a53` 是远端 `next-gen-avatar` 的祖先。
- `main` 没有被修改。

## 最终报告格式

完成后向用户输出：

```text
Repository:
Branch:
Remote URL:
Pushed commits:
Remote next-gen-avatar commit:
Local HEAD:
Match: YES / NO
Working tree clean: YES / NO
Main untouched: YES / NO
Build:
Oxlint:
Secrets found:
```

如果推送仍因网络失败，必须明确报告：

- 本地 commit hash。
- 远端 commit hash。
- 分支 ahead 数量。
- Git 的原始错误。

不要把本地提交成功误报为 GitHub 推送成功。
