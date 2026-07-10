export interface PosterTemplate {
  id: string;
  name: string;
  layout: PosterLayout;
  frameStyle: PosterFrameStyle;
}

export type PosterLayout = 'portrait' | 'landscape' | 'square';

export type PosterFrameStyle = 'magazine' | 'minimal' | 'vibrant' | 'elegant';

export interface Poster {
  id: string;
  outfitId: string;
  templateId: string;
  imageDataUrl: string;
  createdAt: string;
}

export type SharePlatform = 'wechat' | 'moments' | 'xiaohongshu' | 'copy_link' | 'save_image';

export interface ShareConfig {
  title: string;
  description: string;
  imageUrl: string;
  deeplink: string;
  h5Url: string;
}
