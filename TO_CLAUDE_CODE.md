# 给 Claude Code 的完整接管提示词

更新时间：2026-07-24  
仓库：`/Users/jerry/Documents/Codex/ai-meow-outfit`

## 你现在的角色

你是这个仓库的接管工程师。用户已经明确把以下工作交给你：

1. 审计并整理当前工作区；
2. 保留并正确归档比赛文档、视频工程、成片、音频、字幕、PDF、截图和脚本；
3. 修复 Cloudflare 的失败构建；
4. 完成本地验证；
5. 按逻辑拆分提交；
6. 推送到 `origin/next-gen-avatar`；
7. 跟进远端检查直至成功，或给出有证据的外部阻塞说明。

不要只输出方案。先独立检查，随后直接执行已授权的整理、修复、提交和同步工作。

## 绝对边界

- 只能在 `next-gen-avatar` 上整理和推送本次工作。
- 不要直接修改或推送 `main`。
- 不要 force push，不要重写、squash 或 amend 已存在提交。
- 特别不要 amend 当前本地提交 `c707a53`。
- 不要运行 `git reset --hard`、`git clean -fd`、`git checkout -- <path>` 等会丢失本地文件的命令。
- 不要删除或回滚用户已有的文档、视频、音频、PDF、截图、脚本及业务代码。
- 不要提交 `.env`、`.dev.vars`、Token、Cookie、API key、Cloudflare/GitHub 凭据、SSH 凭据或私网服务凭据。
- 不要在没有明确确认时手动部署生产环境、删除远端资源、修改远端密钥或账号配置。由推送自动触发的 CI/CD 属于本任务正常范围。
- 如果远端已经出现新提交，先安全整合；绝不能用 force push 覆盖。

## 第一步：读取事实，不要相信旧记忆

进入仓库并执行：

```bash
cd /Users/jerry/Documents/Codex/ai-meow-outfit
nvm use
git branch --show-current
git status --short --branch
git remote -v
git fetch origin --prune --tags
git rev-list --left-right --count origin/next-gen-avatar...next-gen-avatar
git log --oneline --decorate -10
```

交接时的事实是：

```text
branch: next-gen-avatar
local HEAD: c707a53
origin/next-gen-avatar: bf1e764
ahead: 1
Node: v22.22.2
npm: 10.9.7
```

远端状态随时可能变化，以你实际 `fetch` 后的结果为准。

## 第二步：完整分类工作区

先查看：

```bash
git status --short --branch
git diff --name-status
git diff --stat
git diff -- .gitignore .oxlintrc.json
git ls-files --others --exclude-standard
find . -path './.git' -prune -o -path './node_modules' -prune -o -type f -size +50M -print
```

把文件分为四组：

1. 应提交的业务代码、文档和配置；
2. 应提交的可复现源文件与必要交付物；
3. 应忽略的依赖、缓存、虚拟环境、临时帧和中间渲染；
4. 需要单独决定存储策略的大型二进制文件。

不要因为工作区文件多就整体删除、整体 stash 或整体 `git add .`。先逐类核验，优先使用 `git add -p` 或显式路径。

## 当前已知改动

用户修改过、需要保留并审阅的跟踪文件包括：

```text
deliverables/AIGC应用说明-v2.md
deliverables/README.md
deliverables/比赛玩法说明-v2.md
deliverables/演示视频脚本.md
deliverables/短视频Demo硬性清单-v2.md
```

Codex 为本地接管新增或修改：

```text
.gitignore
.oxlintrc.json
.nvmrc
CLAUDE.md
SESSION_RESUME.md
TO_CLAUDE_CODE.md
```

主要未跟踪内容包括：

```text
OnePager.html
路演Deck.pdf
deliverables/bonus/
deliverables/video-v2/
deliverables/video-v3/
output/
public/qr/
scripts/build_pitch_deck.py
```

这不是完整清单，必须以实际 `git status` 为准。

## 视频和大文件策略

视频项目依赖已被隔离在：

```text
deliverables/video-v2/package.json
deliverables/video-v2/package-lock.json
```

不要把 `remotion` 或 `@remotion/cli` 再加到根项目。

`.gitignore` 已忽略：

```text
deliverables/video-v2/node_modules/
deliverables/video-v2/build/
deliverables/video-v2/output/visual.mp4
deliverables/video-v2/output/narration.m4a
deliverables/video-v2/output/stills/
deliverables/video-v2/output/validation-frames/
deliverables/video-v2/output/video-validation.json
tmp/
```

这些是依赖、缓存、虚拟环境或明确的中间渲染，不要提交。

当前值得单独决策的未跟踪交付物：

```text
deliverables/video-v3/喵搭.mp4
  89,921,382 bytes

deliverables/video-v2/output/AI喵搭-比赛演示-v2.mp4
  33,647,782 bytes

deliverables/video-v3/processed_voice.wav
  17,898,726 bytes
```

注意：

- `喵搭.mp4` 虽低于 GitHub 单文件 100MB 硬上限，但接近上限，会显著膨胀仓库。
- 本机交接时没有安装 Git LFS。
- 不要临时决定 `git lfs track "*.mp4"` 后就直接推送。先检查仓库是否已有 LFS 约定、远端配额和比赛交付需求。
- 如果最终视频不应进入普通 Git，请选择明确方案：Git LFS、GitHub Release/外部交付位置，或保留本地并在文档中记录。不得静默删除或遗漏。
- `subtitles.ass`、`project_edit_notes.txt`、生成脚本和必要的可复现源文件通常适合进入 Git，但仍要核验内容。

## 根项目本地验证基线

交接前已验证：

```bash
npm run lint
npm run build
```

结果：

- lint 返回 0；仍有既有的未使用变量和 Fast Refresh warning。
- production build 返回 0。
- Vite 有一个大于 500kB chunk 的非阻塞 warning。

`.oxlintrc.json` 现在排除了：

```text
deliverables/video-v2/**
output/**
public/vendor/**
tmp/**
```

理由是这些属于独立视频项目、生成输出或第三方 vendor，不应让根应用 lint 因第三方压缩代码失败。

整理完成后至少再次运行：

```bash
npm ci
npm run lint
npm run build
git diff --check
```

如果你修改视频工程，再在 `deliverables/video-v2` 内独立安装和验证；不要污染根依赖。

## Cloudflare 失败检查：必须查日志再修

失败检查：

```text
Workers Builds: ai-meow-outfit
state: FAILURE
build id: 518f5ab9-15c9-4986-879c-554ecbc2e867
started/completed: 2026-07-22T10:34:38Z
```

Dashboard：

```text
https://dash.cloudflare.com/d34547c9fac0c5b36be18d5a83535c62/workers/services/view/ai-meow-outfit/production/builds/518f5ab9-15c9-4986-879c-554ecbc2e867
```

关键线索：

- 失败在同一秒开始和结束。
- 根目录 `npm run build` 在 Node 22 本地通过。
- `.github/workflows/deploy.yml` 是 Cloudflare Pages 流程，只监听 `main`，并执行 `wrangler pages deploy dist --project-name=ai-meow-outfit`。
- `wrangler.avatar.jsonc` 配置的是独立的 `avatar-gateway` Worker，不是前端 `ai-meow-outfit` 静态站。
- 根目录目前没有经过确认的前端 `wrangler.jsonc`。
- 之前没有有效的 Cloudflare Dashboard/Wrangler 登录，所以未取得失败日志。

你的处理顺序：

1. 通过 Cloudflare Dashboard、Wrangler 或 GitHub check 读取该 build 的真实错误文本。
2. 确认 `ai-meow-outfit` 到底应该是：
   - Cloudflare Pages 项目；或
   - Workers Static Assets 项目。
3. 核对 Cloudflare Git 集成的：
   - production branch；
   - root directory；
   - build command；
   - deploy command；
   - output directory；
   - Node 版本；
   - 配置文件路径。
4. 只有在确认项目类型后再修改配置：
   - Pages：对齐 Pages 构建/部署方式，不要误用 `avatar-gateway` 配置；
   - Workers Static Assets：按当前 Cloudflare 官方文档创建前端专用配置，正确指向 `dist` 并处理 SPA 路由。
5. 不要凭猜测把 `wrangler.avatar.jsonc` 改名或覆盖。
6. 本地做相应 dry-run/配置校验，再提交和推送。
7. 推送后持续查看新检查；如果仍失败，读取新日志后继续修复，不能只反复重跑。

如果 Cloudflare 登录是唯一阻塞，明确告诉用户需要在哪个窗口登录或提供何种最小权限；不要索要或打印 Token。

## 文档一致性检查

请读：

```text
README.md
CONTEXT.md
TO_CODEX.md
deliverables/README.md
deliverables/比赛玩法说明-v2.md
deliverables/AIGC应用说明-v2.md
deliverables/短视频Demo硬性清单-v2.md
deliverables/演示视频脚本.md
```

当前比赛主入口应以代码核验，已知候选是：

```text
/#/game
```

重点排查旧描述是否仍混入：

- 旧 `?assist=<code>` 好友裁决；
- 强制 60 秒倒计时和超时自动选择；
- 将旧人体重建实验误写成当前比赛主体验；
- 旧本地路径 `/Users/jerry/PycharmProjects/ai-meow-outfit`；
- 过期 HEAD、部署状态或线上链接。

不要删除有价值的历史技术资料；清楚标注"当前比赛主链路"和"历史/实验入口"即可。

## 建议提交策略

先审计实际 diff，再按职责拆分。可以参考但不要机械照搬：

1. `chore(repo): harden local tooling and generated-file ignores`
2. `docs: refresh competition deliverables and handoff context`
3. `feat(video): add competition video source and delivery assets`
4. `fix(deploy): align Cloudflare build configuration`

要求：

- 保留现有的 `c707a53` 为独立提交。
- 每个新提交前先检查 `git diff --cached --stat` 和 `git diff --cached`。
- 大型二进制单独处理，避免混进文档或配置提交。
- 提交前扫描敏感信息和绝对私网凭据。
- 提交信息说明"为什么"，不要写含糊的 `update files`。

同步流程：

```bash
git fetch origin --prune
git rev-list --left-right --count origin/next-gen-avatar...next-gen-avatar
```

如果远端没有新提交，正常推送：

```bash
git push origin next-gen-avatar
```

如果远端有新提交：

- 不要 force push；
- 先保存好本地逻辑提交；
- 明确检查冲突，再使用合适的 rebase 或 merge；
- 完整重跑验证后正常推送。

## 完成标准

只有同时满足以下条件才算完成：

- 用户文件无丢失；
- 缓存、依赖、虚拟环境、临时帧没有进入 Git；
- 大型视频采用了明确且可解释的存储策略；
- 文档与当前代码/产品主链路一致；
- `npm run lint` 返回 0；
- `npm run build` 返回 0；
- `git diff --check` 返回 0；
- 新提交按逻辑拆分，未 amend `c707a53`；
- `next-gen-avatar` 已正常推送；
- Cloudflare/GitHub 远端检查成功，或只剩需要用户登录/权限的明确外部阻塞；
- 最终向用户报告提交哈希、推送分支、检查链接、未提交的本地文件及原因。

## 你给用户的最终报告格式

请用简洁中文报告：

```text
已完成
- 本地整理：
- Cloudflare 修复：
- 验证：
- 提交：
- 推送：
- 远端检查：

保留在本地、未提交
- 文件：
- 原因：

仍需用户处理
- 仅列真实的权限、登录或产品决策阻塞
```
