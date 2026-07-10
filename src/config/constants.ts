import type { Store, PosterTemplate, BodyType, StyleTag, ColorPreference } from '../types';

/** 身型中文标签 */
export const BODY_TYPES: Record<BodyType, string> = {
  apple: '苹果型',
  pear: '梨型',
  hourglass: '沙漏型',
  rectangle: '矩形',
  inverted_triangle: '倒三角',
};

/** 风格标签中文名 */
export const STYLE_TAGS: Record<StyleTag, string> = {
  minimalist: '极简',
  street: '街头',
  elegant: '优雅',
  vintage: '复古',
  sporty: '运动',
  romantic: '浪漫',
  business: '通勤',
  korean: '韩系',
};

/** 色调偏好中文名 */
export const COLOR_PREFERENCES: Record<ColorPreference, string> = {
  warm: '暖色系',
  cool: '冷色系',
  neutral: '中性色',
  monochrome: '黑白灰',
  vibrant: '亮色系',
};

/** 挑战主题列表 */
export const CHALLENGE_THEMES = [
  { id: 'date', name: '约会穿搭', emoji: '💕' },
  { id: 'office', name: '通勤穿搭', emoji: '💼' },
  { id: 'weekend', name: '周末休闲', emoji: '🌿' },
  { id: 'sporty', name: '运动风', emoji: '🏃' },
  { id: 'minimal', name: '极简主义', emoji: '✨' },
  { id: 'vintage', name: '复古回潮', emoji: '📻' },
  { id: 'summer', name: '夏日清凉', emoji: '🌊' },
  { id: 'winter', name: '冬日暖阳', emoji: '🔥' },
  { id: 'party', name: '派对焦点', emoji: '🎉' },
  { id: 'interview', name: '面试战袍', emoji: '🎯' },
];

/**
 * 门店列表常量
 * STORE_LIST — 银泰百货杭州地区主要门店
 */
export const STORE_LIST: Store[] = [
  {
    id: 'intime-wulin',
    name: '银泰百货（武林店）',
    city: '杭州',
    address: '杭州市拱墅区延安路530号',
    imageUrl: '/mock/items/store-wulin.jpg',
    floors: [
      { level: 'F1', categories: ['cosmetics', 'accessory'], name: '1F 美妆名品馆' },
      { level: 'F2', categories: ['shoes', 'accessory'], name: '2F 鞋履配饰馆' },
      { level: 'F3', categories: ['top', 'bottom', 'dress'], name: '3F 女装潮流馆' },
      { level: 'F4', categories: ['outerwear', 'top', 'bottom'], name: '4F 设计师品牌馆' },
    ],
    openingHours: '10:00-22:00',
  },
  {
    id: 'intime-westlake',
    name: '银泰百货（西湖店）',
    city: '杭州',
    address: '杭州市上城区延安路98号',
    imageUrl: '/mock/items/store-westlake.jpg',
    floors: [
      { level: 'F1', categories: ['cosmetics', 'accessory'], name: '1F 国际美妆' },
      { level: 'F2', categories: ['shoes', 'top', 'bottom'], name: '2F 女装女鞋' },
      { level: 'F3', categories: ['dress', 'outerwear'], name: '3F 精品女装' },
    ],
    openingHours: '10:00-22:00',
  },
  {
    id: 'intime-chengxi',
    name: '银泰百货（城西店）',
    city: '杭州',
    address: '杭州市西湖区丰潭路380号',
    imageUrl: '/mock/items/store-chengxi.jpg',
    floors: [
      { level: 'F1', categories: ['cosmetics'], name: '1F 美妆护肤' },
      { level: 'F2', categories: ['top', 'bottom', 'dress', 'shoes'], name: '2F 年轻女装' },
    ],
    openingHours: '10:00-21:30',
  },
];

/**
 * 海报模板列表
 * POSTER_TEMPLATES — 喵搭分享海报模板
 */
export const POSTER_TEMPLATES: PosterTemplate[] = [
  {
    id: 'template-magazine',
    name: '杂志风',
    layout: 'portrait',
    frameStyle: 'magazine',
  },
  {
    id: 'template-minimal',
    name: '极简白',
    layout: 'square',
    frameStyle: 'minimal',
  },
  {
    id: 'template-vibrant',
    name: '活力彩',
    layout: 'portrait',
    frameStyle: 'vibrant',
  },
  {
    id: 'template-elegant',
    name: '优雅黑',
    layout: 'landscape',
    frameStyle: 'elegant',
  },
];
