/**
 * 分享服务 — 生成分享链接和配置
 */

import type { ShareConfig, Poster, PosterTemplate } from '@/types';
import { buildShareLink, buildSchemeLink } from '@/utils/deepLink';

/** 获取分享配置 */
export async function getShareConfig(outfitId: string): Promise<ShareConfig> {
  const deeplink = buildSchemeLink(outfitId);
  const h5Url = buildShareLink(outfitId);

  return {
    title: '看看AI为我搭配的今日穿搭！',
    description: 'AI喵搭 — 每天一套AI专属穿搭，就在喵街APP',
    imageUrl: '',
    deeplink,
    h5Url,
  };
}

/** 获取海报模板 */
export function getPosterTemplates(): PosterTemplate[] {
  return [
    { id: 'magazine', name: '杂志风', layout: 'portrait', frameStyle: 'magazine' },
    { id: 'minimal', name: '极简风', layout: 'portrait', frameStyle: 'minimal' },
    { id: 'vibrant', name: '活力风', layout: 'portrait', frameStyle: 'vibrant' },
    { id: 'elegant', name: '优雅风', layout: 'portrait', frameStyle: 'elegant' },
  ];
}
