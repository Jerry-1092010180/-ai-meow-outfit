# AI 喵搭 — 交付物

> 正式提交材料与半决赛工作材料分开维护；已提交 PDF 不被现场操作笔记替代。

## 正式评审材料

| 材料 | 文件 | 备注 |
|------|------|------|
| **One Pager（正式版）** | [`AI喵搭-OnePager-正式版.pdf`](./AI喵搭-OnePager-正式版.pdf) | 1 页 A4 |
| **路演 Deck（评审版）** | [`AI喵搭-路演Deck-评审版.pdf`](./AI喵搭-路演Deck-评审版.pdf) | 12 页 16:9 |
| 在线 H5 | `https://next-gen-avatar.ai-meow-outfit.pages.dev/#/game` | 手机浏览器打开 |
| One Pager 源文件 | [`OnePager.html`](./OnePager.html) | 生成源文件，不要求评委阅读 |

## 半决赛工作材料

| 材料 | 文件 / 链接 | 用途 |
|------|-------------|------|
| **展示与提交手册** | [`半决赛展示与提交手册.md`](./半决赛展示与提交手册.md) | 8 分钟讲稿、90 秒 Demo、问答与现场检查 |
| **One Pager（半决赛版）** | [`AI喵搭-OnePager-半决赛版.pdf`](./AI喵搭-OnePager-半决赛版.pdf) | 当前产品叙事；保留已提交正式版不覆盖 |
| **2 分钟演示视频** | [`喵街AI今日角色-比赛Demo-v1.mp4`](../docs/internal/video-production/video/喵街AI今日角色-比赛Demo-v1.mp4) | 网络或设备异常时的离线兜底 |
| **公开 GitHub** | [next-gen-avatar 分支](https://github.com/Jerry-1092010180/-ai-meow-outfit/tree/next-gen-avatar) | 代码、版本和真实性核验 |

## 产品定义

**AI喵搭不是普通试衣工具，而是懂真实商品的个人时尚角色生成器。**

"把今天想穿的，生成成今天的我。"

## 真实性边界

- 当前 H5 交互、选装、角色编辑、邀请链接、多人房间和穿搭广场均可运行
- 角色生成图片和多人海报属于效果演示，生产版由 Gateway AIGC Provider 替换
- 当前商品图和价格/库存是项目样例数据，正式版接入银泰 PIM 与库存服务
- 动态视频尚未接入，属于下一阶段扩展方向
- 私有 GPU 不向浏览器暴露，生产请求只经 API Gateway

## 其他内部文件

以下目录为非提交归档材料，保留用于项目内部追溯，**不建议评委阅读**：

- `docs/internal/not-submitted/` — 未采用的路演 Deck、AIGC 技术文档、加分材料等
- `docs/internal/legacy/` — 旧版 OnePager 和产品文档
- `docs/internal/video-production/` — 视频制作脚本和中间产物
- `docs/internal/handoffs/` — 内部开发交接文件

非正式材料 ≠ 评审交付物。如有任何疑问，以本页面和上述两份正式 PDF 为准。
