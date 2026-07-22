# CLAUDE.md — AI喵搭 项目配置

## 会话初始化（自动执行）

每次 Claude Code 启动时，自动执行以下操作：

1. 确认当前在 `next-gen-avatar` 分支
2. 检查 `SESSION_RESUME.md` 是否有未完成的任务
3. 检查 Git 状态是否有未提交修改

## 会话关闭（自动执行）

每次对话结束时，自动执行：

```bash
# 1. 记录当前会话的关键进展到 session-log.md
echo "- $(date '+%Y-%m-%d %H:%M'): <本次完成的主要工作>" >> docs/session-log.md

# 2. 提交所有修改
git add -A
git commit -m "<本次工作的简短描述>"
git push origin next-gen-avatar

# 3. 同步到 Codex 目录
rsync -a --exclude node_modules --exclude dist --exclude .env --exclude .git /Users/jerry/PycharmProjects/ai-meow-outfit/ /Users/jerry/Documents/Codex/ai-meow-outfit/
```

## 项目红线

1. **所有开发在 `next-gen-avatar` 分支，绝不修改 `main`**
2. **每次提交必须有清晰的 commit message，格式为 `feat|fix|docs|chore(module): description`**
3. **AI 模型必须通过 Provider 接口调用，不可硬编码**
4. **所有 fallback 路径必须输出 `[Avatar]` 标签日志**
5. **绝不把 `.env`、密码、Token、SSH 凭据、内网 IP 提交到 Git**

## 关键文件

| 用途 | 文件 |
|------|------|
| 会话恢复 | `SESSION_RESUME.md` |
| 项目上下文 | `CONTEXT.md` |
| 架构设计 | `ARCHITECTURE.md`、`next-gen-architecture.md` |
| 数据库设计 | `docs/database-design.md` |
| Pipeline 设计 | `docs/avatar-pipeline-design.md` |
| 平台设计 | `docs/avatar-platform-design.md` |
| Debug 审计 | `debug-audit.md` |
| 比赛交付物 | `deliverables/` |
| AIGC 服务器 | `server/avatar_server.py` |
| API Gateway | `server/gateway-worker.js` |

## 部署命令

```bash
npm run build && source .env && npx wrangler pages deploy dist --project-name=ai-meow-outfit
```
