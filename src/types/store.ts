export interface StoreItem {
  id: string;
  name: string;
  brand: string;
  category: ItemCategory;
  price: number;
  originalPrice?: number;
  imageUrl: string;
  storeId: string;
  storeName: string;
  floorLocation: string;
  stockStatus: StockStatus;
  skuId: string;
  tags: string[];
  colors: string[];
  sizes: string[];
  description: string;
}

export type ItemCategory = 'top' | 'bottom' | 'dress' | 'outerwear' | 'shoes' | 'accessory';

export type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock';

export interface Store {
  id: string;
  name: string;
  city: string;
  address: string;
  imageUrl: string;
  floors: StoreFloor[];
  openingHours: string;
}

export interface StoreFloor {
  level: string;
  categories: string[];
  name: string;
}

export interface Coupon {
  id: string;
  name: string;
  description: string;
  type: 'discount' | 'cash';
  value: number;
  minPurchase: number;
  storeId?: string;
  expiresAt: string;
  used: boolean;
  code: string;
}
