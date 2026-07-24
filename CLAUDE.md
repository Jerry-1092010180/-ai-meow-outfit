# Claude Code 项目入口

开始任何操作前，先完整阅读：

1. `TO_CLAUDE_CODE.md`：本次接管任务、真实仓库状态、边界与验收标准。
2. `SESSION_RESUME.md`：2026-07-24 的本地快照。
3. `CONTEXT.md`、`TO_CODEX.md`、`README.md`：产品与技术背景；如内容冲突，以代码和当前交付物为准，并在本次整理中修正文档。

## 固定规则

- 仓库路径：`/Users/jerry/Documents/Codex/ai-meow-outfit`
- 当前工作分支：`next-gen-avatar`
- 使用 Node.js 22；根项目使用根目录 `package.json`，视频项目使用 `deliverables/video-v2/package.json`。
- 不要把 Remotion 依赖重新装到根项目。
- 保留用户已有的文档、视频、音频、PDF、截图和源文件；先分类，再决定是否提交。
- 禁止 `git reset --hard`、`git clean -fd`、`git checkout -- <path>`、force push、重写历史和直接推送 `main`。
- 禁止提交 `.env`、`.dev.vars`、Token、Cookie、Cloudflare/GitHub 凭据或私网服务凭据。
- 用户已授权你完成整理、修复、逻辑拆分提交、推送 `next-gen-avatar` 并跟进远端检查；生产环境手动部署、删除远端资源或修改密钥不在默认授权内。
- 不要 amend 当前未推送的 `c707a53`；新增独立提交。

## 每次结束前

运行 `npm run lint`、`npm run build`、`git diff --check`，检查大文件和敏感信息，并报告：

- 改了什么；
- 生成了哪些提交；
- 推送到哪里；
- 远端检查结果；
- 未解决问题和原因。
