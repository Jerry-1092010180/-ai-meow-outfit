# AI 喵搭 — 交付物

> **本次正式评审材料仅以以下文件为准。**

## 正式评审材料

| 材料 | 文件 | 备注 |
|------|------|------|
| **One Pager（正式版）** | [`AI喵搭-OnePager-正式版.pdf`](./AI喵搭-OnePager-正式版.pdf) | 1 页 A4 |
| **路演 Deck（评审版）** | [`AI喵搭-路演Deck-评审版.pdf`](./AI喵搭-路演Deck-评审版.pdf) | 12 页 16:9 |
| 在线 H5 | `https://next-gen-avatar.ai-meow-outfit.pages.dev/#/game` | 手机浏览器打开 |
| One Pager 源文件 | [`OnePager.html`](./OnePager.html) | 生成源文件，不要求评委阅读 |

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
