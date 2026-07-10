# 部署踩坑日志

> 记录 2026-07-10 ~ 11 部署调试过程中遇到的问题和最终方案，后续 Claude Code 排查时先读此文件。

---

## 最终部署方案

### 评委主入口

**https://c3c21dc7.ai-meow-outfit.pages.dev** — Cloudflare Pages，国内手机网络可访问

### 更新方式

```bash
source .env && ./deploy.sh
```

`.env` 文件（已在 .gitignore 中，不上传 GitHub）：
```
CLOUDFLARE_API_TOKEN=你的token
```

### 备用链接

| 平台 | 链接 | 国内手机 |
|------|------|:---:|
| Vercel | ai-meow-outfit.vercel.app | ❌ 经常不通 |
| GitHub Pages | jerry1092010180.github.io/-ai-meow-outfit | ❌ 蜂窝网络被墙 |

---

## 踩坑记录

### 坑1：Vercel（vercel.app）国内手机网络访问极慢或不通

- **现象**：桌面 Wi-Fi 能打开，手机蜂窝网络加载几分钟后黑屏
- **原因**：vercel.app 域名在国内运营商网络下被限速/间歇性屏蔽
- **尝试**：`vercel login` → `vercel --prod`，部署成功但手机无法访问
- **结论**：不能用 Vercel 做国内评委的主入口

### 坑2：GitHub Pages（github.io）手机蜂窝网络被墙

- **现象**：桌面能打开，手机显示"丢失网络连接"
- **原因**：github.io 域名在国内手机网络下经常被 DNS 污染或阻断
- **尝试**：GitHub Actions 自动部署到 gh-pages 分支成功，但手机无法访问
- **结论**：只能做备用，不能做主入口

### 坑3：Cloudflare Workers（workers.dev）部署方式错误

- **现象**：创建了 Worker 而非 Pages 项目，部署后链接无响应
- **原因**：用户通过 Cloudflare 仪表盘创建时选了 Worker，Worker 不会自动托管静态站点
- **解决**：用 `wrangler pages deploy dist` 部署到 Cloudflare Pages

### 坑4：Cloudflare API Token 权限

- **现象**：本地 `wrangler deploy` 成功，但创建 GitHub Actions 时报认证错误
- **原因**：本地 token 有效，但 CI 环境中 token 环境变量传递有问题
- **解决**：放弃 GitHub Actions 自动部署 Cloudflare，改用手动 `./deploy.sh`

### 坑5：RPM 3D 模型 URL 全部失效

- **现象**：TryOn 页面持续转圈，不显示 3D 模型
- **原因**：三个 Ready Player Me 公共 GLB URL 全部失效（连接被拒/404）
- **解决**：改用 Three.js 原生几何体程序化拼合人体模型，零外部依赖

### 坑6：@react-three/drei Environment 组件加载失败导致 3D 白屏

- **现象**：`<Environment preset="city" />` 尝试从 CDN 加载 `potsdamer_platz_1k.hdr`，国内网络下载失败
- **解决**：移除 Environment 组件，用 3 点布光替代环境贴图

### 坑7：GitHub Actions `npm ci` 和 `npx` 在 CI 环境失败

- **现象**：CI 报 `The process 'npx' failed with exit code 1`
- **原因**：`npm ci` 要求 `package-lock.json` 与 `package.json` 严格一致（跨平台差异），`npx` 在 CI 的受限网络下不稳定
- **解决**：CI 中用 `npm install` 替代 `npm ci`，用 `./node_modules/.bin/wrangler` 替代 `npx wrangler`

### 坑8：路由模式与不同平台的 base path

- **现象**：BrowserRouter 在 GitHub Pages 子路径下路由失效（`/-ai-meow-outfit/xxx` 刷新 404）
- **原因**：GitHub Pages 不支持 SPA 的 history fallback，Vercel/Cloudflare 不支持子路径
- **解决**：改用 HashRouter（URL 变成 `/#/path`），所有平台兼容，无需配置 base path

### 坑9：Mock 数据 fetch 路径不兼容不同 base URL

- **现象**：GitHub Pages 部署后，选择心情报"生成失败"
- **原因**：`fetch('/mock/data/outfits.json')` 写死了根路径，GitHub Pages 的子路径 `/-ai-meow-outfit/` 下变成 404
- **解决**：改用 `import.meta.env.BASE_URL` 动态拼接路径，同时添加 6 套内置兜底穿搭，mock 加载失败时自动切换

---

## 部署命令速查

### Cloudflare Pages（主入口）

```bash
# 本地手动部署
source .env && ./deploy.sh

# 或者分步
npx vite build
CLOUDFLARE_API_TOKEN=xxx npx wrangler pages deploy dist --project-name=ai-meow-outfit
```

### Vercel（备用）

```bash
npx vercel --prod
```

### GitHub Pages（备用，自动触发）

```bash
git push  # .github/workflows/deploy.yml 自动部署
```

### 本地开发

```bash
npm run dev           # 启动开发服务器
npm run build         # 生产构建
npm run preview       # 预览生产构建
```

---

## .env 文件模板

```
CLOUDFLARE_API_TOKEN=你的Cloudflare_API_Token
```

---

## Cloudflare Token 创建步骤

1. https://dash.cloudflare.com/profile/api-tokens → Create Token
2. 选 "Edit Cloudflare Workers" 模板
3. 直接 Continue to summary → Create Token
4. 复制 token 到 `.env` 文件

⚠️ **不要在聊天窗口粘贴 API token**
