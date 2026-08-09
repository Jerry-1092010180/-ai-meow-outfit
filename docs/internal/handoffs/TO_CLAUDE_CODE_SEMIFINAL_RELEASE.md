# 给 Claude Code 的半决赛发布提示词包

> 生成日期：2026-08-10  
> 仓库：`/Users/jerry/Documents/Codex/ai-meow-outfit`  
> 工作分支：`next-gen-avatar`  
> 线上地址：<https://next-gen-avatar.ai-meow-outfit.pages.dev/#/game>

## 当前状态摘要

### 已完成，但尚未提交/推送

- H5 首屏增加“开始完整体验 / 30 秒看结果”快速入口。
- 共创链接复制增加旧浏览器兜底，并补充成功、降级和失败提示。
- 底部导航层级修正，避免遮挡关键交互。
- HTML meta 描述更新为当前“完整选搭、个人角色、好友共创、商品回链”口径。
- 新增 `scripts/smoke-test.mjs`：验证首屏、快速生成、复制链接和好友加入。
- 新增 `scripts/verify-materials.mjs`：验证 PDF、视频、二维码和手册完整性。
- 新增 `scripts/generate-onepager.mjs`：从 HTML 生成半决赛 One Pager。
- 新增 `deliverables/AI喵搭-OnePager-半决赛版.pdf`，保留旧正式版不覆盖。
- 新增 `deliverables/半决赛展示与提交手册.md`：8 分钟讲稿、90 秒 Demo、问答、分工和检查清单。
- README 与交付物索引已更新。
- 本地已通过生产构建、修改文件 lint、材料校验和浏览器烟雾测试。

最近一次本地烟雾测试结果：首屏约 505ms、快速生成约 3.2s、好友加入约 1.5s，复制反馈成功。

### 尚未完成

- 逐项复核未提交的 diff，确认没有误改或遗漏。
- 将上述文件提交到 `next-gen-avatar`。
- 推送 GitHub，触发 `.github/workflows/deploy.yml`。
- 等待 Cloudflare Pages CI 完成并验证新的线上版本。
- 在线运行 `demo:smoke`，确认生成、复制和好友加入在正式域名也通过。
- 输出最终 commit SHA、GitHub Actions 链接、部署地址和剩余风险。

本地 Wrangler 登录已过期，但 GitHub Actions 最近在 `next-gen-avatar` 上连续部署成功，因此优先走 GitHub CI，不要要求本地 Wrangler 登录。

---

## 提示词 A：完成提交、推送、部署和线上验收

将下面整段复制给 Claude Code：

```text
你正在接手 AI喵搭 OPC 半决赛版本的最终发布工作。

仓库绝对路径：/Users/jerry/Documents/Codex/ai-meow-outfit
唯一允许工作的分支：next-gen-avatar
远端：origin = git@github.com:Jerry-1092010180/-ai-meow-outfit.git
线上地址：https://next-gen-avatar.ai-meow-outfit.pages.dev/#/game

目标：复核现有未提交改动，完成测试、GitHub 提交与推送，等待 GitHub Actions 部署到 Cloudflare Pages，并完成线上验收。用户明确授权本任务中的 git add、git commit 和 git push；不要修改 main。

重要原则：
1. 先检查事实，再执行。不要重做已经完成的产品设计，也不要把当前个人时尚角色叙事改回旧的 3D 试穿/好友 PK 叙事。
2. 当前工作区中的修改属于用户和上一位开发者，禁止 git reset --hard、git checkout --、git clean、强制推送、rebase 或删除未跟踪文件。
3. 不要修改或覆盖 deliverables/AI喵搭-OnePager-正式版.pdf；半决赛使用新增的 AI喵搭-OnePager-半决赛版.pdf。
4. 不要提交 node_modules、dist、tmp、日志、浏览器截图或任何环境文件。
5. 不要读取、打印或写入 Cloudflare/GitHub 密钥。不要修改 wrangler.avatar.jsonc；它属于独立 avatar-gateway，不是前端 Pages 配置。
6. 本地 Wrangler 登录已过期。优先通过 push 触发 GitHub Actions；除非用户之后明确要求，不执行 wrangler login 或本地 wrangler pages deploy。
7. 若 GitHub SSH/CLI 权限缺失，停止在需要用户登录的准确步骤，保留全部本地工作，不要改用不安全的 token 方案。

当前预期改动：
- README.md
- deliverables/OnePager.html
- deliverables/README.md
- deliverables/AI喵搭-OnePager-半决赛版.pdf
- deliverables/半决赛展示与提交手册.md
- index.html
- package.json
- scripts/generate-onepager.mjs
- scripts/smoke-test.mjs
- scripts/verify-materials.mjs
- src/components/common/BottomNav.tsx
- src/pages/DailyQuestPage.tsx
- src/utils/deepLink.ts

阶段一：复核现状
1. cd 到仓库绝对路径。
2. 运行 git fetch --prune，再运行：git status --short --branch、git diff --check、git diff --stat、git diff。
3. 确认当前分支是 next-gen-avatar。生成本提示词时 HEAD 与 origin/next-gen-avatar 均为 4ee46f5（部署触发提交）；若远端已有后继提交，先比较历史和改动，不要在脏工作区直接 pull、rebase 或覆盖文件。确认没有意外的用户新改动。
4. 逐项检查上述文件，尤其确认：
   - 首屏能看到“开始完整体验”和“30 秒看结果”；
   - 复制共创链接使用 copyToClipboard 并给出 Toast；
   - One Pager 半决赛版和展示手册链接正确；
   - package.json 包含 demo:smoke、materials:verify、onepager:build；
   - README 不再链接不存在的 AI喵搭-OnePager-评审版.pdf。
5. 不要因为格式偏好改写大段已完成文案。只修阻断发布的实际问题。

阶段二：本地验收
1. 运行 npm run build，必须 exit 0。大包体 warning 可记录，不作为阻断。
2. 运行 npm run lint，必须 exit 0；历史 warning 可记录，不能新增 error。
3. 运行 npm run materials:verify，必须显示 ok: true。
4. 不要无故重新生成 PDF。仅当 deliverables/OnePager.html 在本轮被修改时，才运行 npm run onepager:build，随后再次运行 materials:verify，并用 pdfinfo 确认半决赛 PDF 为 1 页 A4。
5. 启动本地服务：npm run dev -- --host 127.0.0.1。使用独立终端/后台进程并记录 PID，测试后关闭。
6. 运行：npm run demo:smoke -- 'http://127.0.0.1:5173/#/game'。必须满足：
   - quickStartVisible = true；
   - 出现“共创链接已复制”；
   - 快速生成进入“你的今日动漫角色已生成”；
   - 好友页进入“你已加入 2/4 人角色场景”；
   - 无 pageerror 或 console error。
7. 再次运行 git diff --check。

阶段三：精确提交
1. 使用显式文件列表 git add，只加入当前半决赛改动；不要 git add -A：
   README.md
   deliverables/OnePager.html
   deliverables/README.md
   deliverables/AI喵搭-OnePager-半决赛版.pdf
   deliverables/半决赛展示与提交手册.md
   index.html
   package.json
   scripts/generate-onepager.mjs
   scripts/smoke-test.mjs
   scripts/verify-materials.mjs
   src/components/common/BottomNav.tsx
   src/pages/DailyQuestPage.tsx
   src/utils/deepLink.ts
   docs/internal/handoffs/TO_CLAUDE_CODE_SEMIFINAL_RELEASE.md（如果该文件存在且内容未被意外改写）
2. 运行 git diff --cached --check 和 git diff --cached --stat。
3. 检查 git status，确保 dist、tmp、node_modules、日志和秘密文件未暂存。
4. 创建一次提交，建议提交信息：
   feat(semifinal): harden demo flow and refresh judge materials
5. 输出提交 SHA，并确认工作区是否还有未提交的用户文件；不要擅自纳入其他文件。

阶段四：推送和 CI 部署
1. 执行：git push origin next-gen-avatar。
2. 推送成功后，找到本次 “Deploy to Cloudflare Pages” GitHub Actions run。
   - 若 gh CLI 可用：gh run list --workflow='Deploy to Cloudflare Pages' --branch=next-gen-avatar --limit=5
   - 监控对应 run：gh run watch <run-id> --exit-status
   - 若 gh 不可用，使用 GitHub 公共 Actions 页面/API读取状态；不要要求安装插件。
3. CI 失败时不要重复 push 空提交。先读取失败 job/log，按“提示词 B”的原则只修根因。
4. CI 成功后记录 Actions URL 和部署完成时间。

阶段五：线上验收
1. 使用 curl 验证以下资源返回 HTTP 200：
   - https://next-gen-avatar.ai-meow-outfit.pages.dev/
   - https://next-gen-avatar.ai-meow-outfit.pages.dev/#/game
   - https://next-gen-avatar.ai-meow-outfit.pages.dev/qr/ai-meow-h5.png
   - favicon 和当前 HTML 引用的 JS/CSS 资源。
2. 检查线上 index.html 的 meta description 已变为：
   银泰喵街每日 AI 角色副本：完整选搭、个人角色生成、好友共创与真实商品回链。
3. 在线运行：
   npm run demo:smoke -- 'https://next-gen-avatar.ai-meow-outfit.pages.dev/#/game'
   必须通过首屏、生成、复制和好友加入全部检查。
4. 用 390×844 或相近移动端视口做视觉确认：首屏快速入口可见、底部导航不遮挡按钮、结果页角色清晰、好友页显示 2/4。
5. 检查 GitHub README 中 H5、半决赛 One Pager 和展示手册链接在远端可打开。
6. 若 CDN 短暂缓存旧页面，比较 HTML/资源 hash，并在合理时间内重试；不要凭感觉宣布部署成功。

最终回复必须包含：
- 完成了哪些复核或修复；
- 测试命令和结果；
- commit SHA；
- push 的分支；
- GitHub Actions URL 与结论；
- 最终线上 URL；
- 线上 smoke test 的关键耗时；
- 仍然存在的真实边界：样例商品/库存、效果预览 AIGC、浏览器侧 Demo 房间；
- 是否还有未提交文件。

除非出现权限、登录、缺失秘密或需要改产品方向的阻塞，否则持续完成到线上验收，不要只给操作建议。
```

---

## 提示词 B：GitHub Actions / Cloudflare 部署失败时

仅在提示词 A 的 CI 阶段失败后使用：

```text
继续处理 AI喵搭 next-gen-avatar 的 GitHub Actions 部署失败。不要创建空提交，不要切换 main，不要本地 wrangler login，也不要打印任何 secret。

先给出证据：
1. 读取本次失败 run 的 job、失败 step 和关键错误日志。
2. 对比 .github/workflows/deploy.yml、package.json、package-lock.json 和最近一次成功 run。
3. 判断失败属于哪一类：npm ci/lockfile、TypeScript/build、Cloudflare secret、Pages project/branch、临时网络、资源大小或 GitHub 权限。

修复边界：
- npm ci 失败：确认 package.json 与 package-lock.json 是否真的不一致；只在依赖变化时更新 lockfile。本轮只新增 scripts，通常不应新增依赖。
- build 失败：本地复现 npm ci && npm run build，修真正的类型/构建问题。
- Cloudflare secret 缺失或过期：不要猜测、输出或新建 token；明确告诉用户需要在 GitHub Repository Secrets 更新 CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID，并停止在该权限步骤。
- Pages 配置：项目名必须是 ai-meow-outfit，部署分支必须是 next-gen-avatar。
- 不要修改 wrangler.avatar.jsonc，它属于 avatar-gateway。
- 临时网络失败：在确认日志属于瞬时错误后，只 rerun failed jobs；不要改代码。

如需代码修复：
1. 只修改根因相关文件。
2. 重新运行 build、lint、materials:verify、本地 demo:smoke。
3. 创建一个说明明确的修复提交并 push。
4. 等待新的 CI 成功，再执行完整线上 smoke test。

最终报告：失败根因、证据、修复文件、修复 commit、Actions URL、线上验证结果和是否需要用户更新 secret。
```

---

## 提示词 C：半决赛前 24 小时最终巡检

部署成功后，在比赛前一天使用：

```text
对 AI喵搭半决赛版本做只读优先的最终巡检。仓库是 /Users/jerry/Documents/Codex/ai-meow-outfit，分支 next-gen-avatar，线上地址 https://next-gen-avatar.ai-meow-outfit.pages.dev/#/game。

目标是发现会阻断现场展示的问题，不进行产品重构。默认不修改、不提交、不推送；只有发现明确 P0/P1 演示故障时，先报告证据和最小修复方案，再等待用户授权修改。

检查：
1. git status 与 origin/next-gen-avatar 是否一致，记录线上部署对应 SHA。
2. 运行 npm run build、npm run lint、npm run materials:verify。
3. 运行线上 npm run demo:smoke -- 'https://next-gen-avatar.ai-meow-outfit.pages.dev/#/game'。
4. 用手机视口验证：首屏入口、快速生成、形象/动作/背景标签、复制链接 Toast、好友 2/4 同框、商品入口。
5. 验证 H5、GitHub、半决赛 One Pager、Deck、视频和二维码可访问；视频本地文件应为约 1:59、1920×1080、H.264/AAC。
6. 确认不需要登录，浏览器不会弹出未授权权限请求；测试普通网络和手机热点。
7. 检查 deliverables/半决赛展示与提交手册.md 中的 8 分钟节奏、90 秒 Demo 和备用路径仍与线上 UI 一致。
8. 输出 P0/P1/P2 风险清单、现场主路径、45 秒压缩路径和断网时切换本地视频的明确时机。

禁止虚构用户数据、增长结果、商业订单或生产 AIGC 能力。明确区分当前可运行交互、效果预览和待接入的银泰 PIM/库存/会员服务。
```
