/**
 * Canvas 海报合成引擎
 * 在客户端生成可分享的时尚海报
 */

import type { GeneratedOutfit } from '@/types/outfit';
import type { PosterTemplate } from '@/types/share';

interface PosterConfig {
  width: number;
  height: number;
  outfit: GeneratedOutfit;
  template: PosterTemplate;
  userAvatar?: string;
  userName?: string;
}

/** 海报模板预设 */
export const POSTER_PRESETS = {
  magazine: {
    width: 750,
    height: 1334,
    titleFont: 'bold 48px "PingFang SC", sans-serif',
    bodyFont: '28px "PingFang SC", sans-serif',
    smallFont: '22px "PingFang SC", sans-serif',
    colors: {
      bg: '#1A1A2E',
      title: '#FFFFFF',
      text: '#CCCCCC',
      accent: '#FF6B8A',
      overlay: 'rgba(0,0,0,0.3)',
    },
  },
  minimal: {
    width: 750,
    height: 1334,
    titleFont: 'bold 44px "PingFang SC", sans-serif',
    bodyFont: '28px "PingFang SC", sans-serif',
    smallFont: '22px "PingFang SC", sans-serif',
    colors: {
      bg: '#FFFFFF',
      title: '#2D2D2D',
      text: '#666666',
      accent: '#FF6B8A',
      overlay: 'rgba(255,255,255,0.6)',
    },
  },
  vibrant: {
    width: 750,
    height: 1334,
    titleFont: 'bold 52px "PingFang SC", sans-serif',
    bodyFont: '30px "PingFang SC", sans-serif',
    smallFont: '24px "PingFang SC", sans-serif',
    colors: {
      bg: '#FF6B8A',
      title: '#FFFFFF',
      text: '#FFE0E6',
      accent: '#FFD700',
      overlay: 'rgba(0,0,0,0.15)',
    },
  },
  elegant: {
    width: 750,
    height: 1334,
    titleFont: 'bold 44px "PingFang SC", serif',
    bodyFont: '28px "PingFang SC", serif',
    smallFont: '22px "PingFang SC", serif',
    colors: {
      bg: '#F5F0EB',
      title: '#3C2415',
      text: '#8B7355',
      accent: '#C9A96E',
      overlay: 'rgba(245,240,235,0.5)',
    },
  },
};

type PresetKey = keyof typeof POSTER_PRESETS;

/** 加载图片 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** 圆角矩形 */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/** 合成海报 */
export async function composePoster(config: PosterConfig): Promise<string> {
  const presetKey = config.template.frameStyle as PresetKey;
  const preset = POSTER_PRESETS[presetKey] || POSTER_PRESETS.magazine;
  const { width, height, outfit, userAvatar, userName } = config;
  const { colors } = preset;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // 1. 背景
  ctx.fillStyle = colors.bg;
  ctx.fillRect(0, 0, width, height);

  // 2. 场景图（穿搭图）
  try {
    const sceneImg = await loadImage(outfit.sceneImage);
    const imgHeight = height * 0.65;
    ctx.drawImage(sceneImg, 0, 0, width, imgHeight);

    // 渐变遮罩
    const gradient = ctx.createLinearGradient(0, imgHeight - 200, 0, imgHeight);
    gradient.addColorStop(0, 'transparent');
    gradient.addColorStop(1, colors.bg);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, imgHeight - 200, width, 200);
  } catch {
    // 图片加载失败，用纯色替代
    ctx.fillStyle = colors.accent;
    ctx.fillRect(0, 0, width, height * 0.4);
  }

  // 3. 底部信息区
  const infoY = height * 0.68;

  // 风格评分
  const scoreX = width - 120;
  const scoreY = infoY - 30;
  ctx.beginPath();
  ctx.arc(scoreX, scoreY, 40, 0, Math.PI * 2);
  ctx.fillStyle = colors.accent;
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 32px "PingFang SC", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(String(outfit.styleScore), scoreX, scoreY + 12);

  // 穿搭名称
  ctx.fillStyle = colors.title;
  ctx.font = preset.titleFont;
  ctx.textAlign = 'left';
  ctx.fillText(outfit.name, 40, infoY + 20);

  // 心情 + 天气
  const moodEmojis: Record<string, string> = {
    happy: '😊', calm: '😌', energetic: '⚡', chill: '😎', romantic: '💕', confident: '💪',
  };
  const weatherEmojis: Record<string, string> = {
    sunny: '☀️', cloudy: '☁️', rainy: '🌧️', snowy: '❄️', windy: '💨',
  };
  const moodStr = `${moodEmojis[outfit.mood] || ''} ${outfit.mood}`;
  const weatherStr = `${weatherEmojis[outfit.weather.condition] || ''} ${outfit.weather.temperature}°C`;
  ctx.fillStyle = colors.text;
  ctx.font = preset.bodyFont;
  ctx.fillText(`${moodStr} · ${weatherStr}`, 40, infoY + 70);

  // 风格描述
  ctx.font = preset.smallFont;
  const desc = outfit.styleDescription;
  const maxWidth = width - 80;
  const words = desc.split('');
  let line = '';
  let descY = infoY + 110;
  const lineHeight = 38;

  for (const char of words) {
    const testLine = line + char;
    if (ctx.measureText(testLine).width > maxWidth) {
      ctx.fillText(line, 40, descY);
      line = char;
      descY += lineHeight;
    } else {
      line = testLine;
    }
  }
  if (line) ctx.fillText(line, 40, descY);

  // 4. 单品标签行
  const tagsY = height - 180;
  ctx.fillStyle = colors.accent;
  ctx.font = preset.smallFont;
  const tagText = outfit.pieces.map((p) => p.name).join(' | ');
  ctx.fillText(tagText, 40, tagsY);

  // 5. 用户信息
  const userY = height - 120;
  if (userAvatar) {
    try {
      const avatarImg = await loadImage(userAvatar);
      ctx.save();
      ctx.beginPath();
      ctx.arc(60, userY, 24, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(avatarImg, 36, userY - 24, 48, 48);
      ctx.restore();
    } catch {
      // skip avatar
    }
  }

  ctx.fillStyle = colors.text;
  ctx.font = preset.smallFont;
  ctx.textAlign = 'left';
  ctx.fillText(userName || '喵街会员', 96, userY + 6);

  // 6. 底部品牌区
  const brandY = height - 60;
  ctx.fillStyle = colors.text;
  ctx.font = '20px "PingFang SC", sans-serif';
  ctx.textAlign = 'center';

  // 品牌分隔线
  ctx.strokeStyle = colors.text;
  ctx.globalAlpha = 0.3;
  ctx.beginPath();
  ctx.moveTo(width * 0.15, brandY - 10);
  ctx.lineTo(width * 0.85, brandY - 10);
  ctx.stroke();
  ctx.globalAlpha = 1;

  ctx.fillText('银泰百货 · 喵街APP · AI喵搭', width / 2, brandY + 10);

  // 7. 二维码占位
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(width - 120, height - 200, 90, 90);
  ctx.fillStyle = colors.text;
  ctx.font = '14px "PingFang SC", sans-serif';
  ctx.fillText('扫码体验', width - 75, height - 100);

  return canvas.toDataURL('image/png', 0.95);
}

/** 快速生成分享海报（简化版，不加载图片） */
export function generateSimplePoster(outfit: GeneratedOutfit, template: PosterTemplate): string {
  const canvas = document.createElement('canvas');
  canvas.width = 750;
  canvas.height = 1334;
  const ctx = canvas.getContext('2d')!;

  // 渐变背景
  const gradient = ctx.createLinearGradient(0, 0, 0, 1334);
  gradient.addColorStop(0, '#FF6B8A');
  gradient.addColorStop(1, '#FFB8C6');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 750, 1334);

  // 标题
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 48px "PingFang SC", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(outfit.name, 375, 400);

  // 评分
  ctx.font = 'bold 72px "PingFang SC", sans-serif';
  ctx.fillText(String(outfit.styleScore), 375, 500);
  ctx.font = '24px "PingFang SC", sans-serif';
  ctx.fillText('风格评分', 375, 540);

  // 品牌
  ctx.font = '28px "PingFang SC", sans-serif';
  ctx.fillText('银泰百货 · 喵街APP', 375, 1100);
  ctx.font = '22px "PingFang SC", sans-serif';
  ctx.fillText('扫码体验 AI喵搭', 375, 1140);

  return canvas.toDataURL('image/png', 0.9);
}
