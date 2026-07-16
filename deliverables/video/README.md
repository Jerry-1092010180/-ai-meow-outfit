# 喵街 AI 今日角色：比赛短视频 Demo

## 最终文件

- `喵街AI今日角色-比赛Demo-v1.mp4`：119.2 秒，1920×1080、30 fps、H.264、AAC 双声道中文旁白。
- `喵街AI今日角色-视频封面.png`：视频封面。
- `timeline.json`：逐段起止时间与旁白文本。
- `validation.json`：最终编码、分辨率、音轨和时长验证结果。

最终音轨已进行响度标准化；自动检测未发现超过 1.2 秒的异常静音。

## 内容结构

1. 中低频会员缺少每日打开理由。
2. 七日剧情、次日预告与角色卡形成每日钩子。
3. 用户用 60 秒完成三轮商品选择。
4. AI 读取天气、风格、选择与库存。
5. A 保留三件，B 保留身份单品并由 AI 替换两件。
6. 好友选择最终封面。
7. 投票回流解锁到店券与试穿任务。
8. 说明当前真实能力和生产 AIGC 接入边界。

## 真实性声明

- 视频中的 H5 交互链路和 A/B 商品决策结构已经真实实现。
- 当前个性穿搭海报属于比赛原型效果示意，不冒充在线扩散模型输出。
- 生产版本目标是经 API Gateway 调用私有 AIGC 算力，并由 CDN 返回生成资产。

## 重新生成

脚本依赖 macOS 中文语音 `Tingting`、Pillow、ffmpeg 和 ffprobe：

```bash
/Users/jerry/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 \
  deliverables/video/build_demo_video.py
```
