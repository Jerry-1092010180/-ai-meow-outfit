/**
 * 门店服务 — 商品查询与购买
 */

import type { StoreItem, Coupon } from '@/types';
import { getMockItems, pickOne } from '@/utils/mock';

/** 获取门店商品列表 */
export async function getStoreItems(
  storeId?: string,
  category?: string,
  tags?: string[]
): Promise<StoreItem[]> {
  let items = await getMockItems();

  if (storeId) {
    items = items.filter((item) => item.storeId === storeId);
  }
  if (category) {
    items = items.filter((item) => item.category === category);
  }
  if (tags && tags.length > 0) {
    items = items.filter((item) =>
      tags!.some((tag) => item.tags.includes(tag))
    );
  }

  return items;
}

/** 获取门店列表 */
export function getStoreList() {
  return [
    { id: 'store-hzwl', name: '杭州武林银泰', city: '杭州', address: '延安路530号' },
    { id: 'store-hzxh', name: '杭州西湖银泰', city: '杭州', address: '延安路98号' },
    { id: 'store-nbdm', name: '宁波东门银泰', city: '宁波', address: '中山东路218号' },
    { id: 'store-nbty', name: '宁波天一银泰', city: '宁波', address: '天一广场' },
    { id: 'store-hzcx', name: '杭州城西银泰', city: '杭州', address: '丰潭路380号' },
  ];
}

/** 模拟购买 */
export async function purchaseItems(
  items: { skuId: string; quantity: number }[],
  _storeId: string
): Promise<{ orderId: string; coupon?: Coupon }> {
  const orderId = `MM-${Date.now()}`;

  // 随机发放优惠券
  const shouldGiveCoupon = Math.random() > 0.3;
  const coupon: Coupon | undefined = shouldGiveCoupon
    ? {
        id: `cpn-${Date.now()}`,
        name: '银泰专属优惠券',
        description: '下次购物满200减30',
        type: 'discount',
        value: 30,
        minPurchase: 200,
        expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
        used: false,
        code: `CP${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      }
    : undefined;

  return { orderId, coupon };
}
