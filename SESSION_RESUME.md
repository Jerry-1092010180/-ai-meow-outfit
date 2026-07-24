# 会话恢复点 — 2026-07-24

本文件只记录交接时的本地事实。完整任务见 `TO_CLAUDE_CODE.md`。

## 仓库

- 路径：`/Users/jerry/Documents/Codex/ai-meow-outfit`
- 远端：`https://github.com/Jerry-1092010180/-ai-meow-outfit.git`
- 分支：`next-gen-avatar`
- 本地 HEAD：`c707a53 feat(game): refine intuitive outfit selection and public look plaza`
- 远端跟踪分支：`origin/next-gen-avatar`
- 交接时本地比远端多 1 个提交；开始工作后必须重新 `git fetch --prune` 核验。
- 工作区不是干净状态，包含用户修改的比赛文档、视频工程、成片、PDF、截图和生成脚本。

## 本地工具

- Node.js：`v22.22.2`
- npm：`10.9.7`
- `.nvmrc`：`22`
- 根项目：Vite + React；`npm run build` 已通过。
- `npm run lint` 已通过但仍有非阻塞 warning。
- 视频项目有独立的 `deliverables/video-v2/package.json` 和 lockfile。
- 根项目中曾误加的 Remotion 依赖已从 `package.json` / `package-lock.json` 清理，两个根依赖文件在交接时与 HEAD 一致。

## 本地 Git 选项

仓库级 `.git/config` 已设置：

- `core.quotepath=false`
- `fetch.prune=true`
- `pull.ff=only`
- `push.autoSetupRemote=true`
- `remote.pushDefault=origin`
- `branch.next-gen-avatar.pushRemote=origin`
- `rerere.enabled=true`

Git 提交身份已存在。Git LFS 在交接时未安装。

## 已做的本地整理

- `.gitignore` 新增 Cloudflare 缓存、本地环境文件、临时渲染目录、视频虚拟环境/缓存及明确中间产物规则。
- `.oxlintrc.json` 排除第三方 vendor、视频独立工程和生成输出，避免 vendor 代码导致根项目 lint 失败。
- 最终视频、字幕、处理后人声、PDF 和可复现源文件没有被删除。
- 未执行 `git add`、`git commit`、`git push` 或远端部署。

## Cloudflare 线索

- 失败检查：`Workers Builds: ai-meow-outfit`
- Build ID：`518f5ab9-15c9-4986-879c-554ecbc2e867`
- 失败时间：2026-07-22 10:34:38 UTC，开始和结束为同一秒。
- Dashboard：
  `https://dash.cloudflare.com/d34547c9fac0c5b36be18d5a83535c62/workers/services/view/ai-meow-outfit/production/builds/518f5ab9-15c9-4986-879c-554ecbc2e867`
- 根项目本地构建通过，因此要优先核对 Cloudflare 项目类型、Git 集成、根目录、构建命令、输出目录和配置文件发现逻辑。
- `.github/workflows/deploy.yml` 当前是 Cloudflare Pages 流程，只监听 `main`。
- `wrangler.avatar.jsonc` 是另一个名为 `avatar-gateway` 的 Worker，不能误当成前端静态站配置。
- 之前的浏览器会话和本地 Wrangler 都没有有效 Cloudflare 登录，因此没有拿到失败日志。
