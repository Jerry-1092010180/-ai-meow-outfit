import type { StoreItem } from '@/types/store';
import type {
  AvatarOutfit,
  AvatarOutfitCategory,
  AvatarOutfitProvider,
  AvatarOutfitFittingMode,
} from '@/types/avatarSystem';
import { getMockItems } from '@/utils/mock';

const CATEGORY_PRIORITY: AvatarOutfitCategory[] = ['top', 'outerwear', 'dress', 'bottom'];
const BASE = import.meta.env.BASE_URL;

const REAL_GARMENT_ASSETS: Record<string, string> = {
  'item-001': `${BASE}garments/theory-silk-blouse.glb`,
  'item-004': `${BASE}garments/burberry-trench-coat.glb`,
  'item-012': `${BASE}garments/sandro-satin-slip-dress.glb`,
};

const COLOR_HEX: Record<string, string> = {
  白色: '#f4f4ee',
  米色: '#d9c7a6',
  浅蓝: '#8fb8dc',
  黑色: '#23222a',
  深灰: '#555660',
  卡其: '#b79a72',
  裸色: '#e7b88f',
  红色: '#c6424c',
  驼色: '#bd9367',
  灰色: '#8f9299',
  粉色: '#ee9ab3',
  碎花蓝: '#7898c8',
  碎花粉: '#e9a7bc',
  浅灰: '#c6c8c9',
  深蓝: '#2c5276',
  香槟金: '#d7b46d',
  酒红: '#803044',
  蓝白条纹: '#8fb8dc',
  灰白条纹: '#b9bdc3',
  薄荷绿: '#98d8b8',
};

function firstColorHex(item: StoreItem) {
  const label = item.colors[0] ?? '';
  return COLOR_HEX[label] ?? '#ed7199';
}

function secondaryColorHex(item: StoreItem) {
  const label = item.colors[1] ?? item.colors[0] ?? '';
  return COLOR_HEX[label] ?? '#f4f4ee';
}

function trimColorFor(category: AvatarOutfitCategory) {
  if (category === 'bottom') return '#15151a';
  if (category === 'outerwear') return '#f2d16b';
  if (category === 'dress') return '#ffffff';
  return '#23222a';
}

function fittingModeFor(category: AvatarOutfitCategory): AvatarOutfitFittingMode {
  if (category === 'accessory' || category === 'shoes') return 'rigid-attach';
  return 'skinned-compatible';
}

function requiredBonesFor(category: AvatarOutfitCategory) {
  if (category === 'bottom') {
    return ['Hips', 'LeftUpperLeg', 'LeftLowerLeg', 'RightUpperLeg', 'RightLowerLeg'];
  }
  if (category === 'dress') {
    return ['Spine', 'Chest', 'Hips', 'LeftUpperLeg', 'RightUpperLeg'];
  }
  if (category === 'outerwear' || category === 'top') {
    return ['Spine', 'Chest', 'LeftUpperArm', 'LeftLowerArm', 'RightUpperArm', 'RightLowerArm'];
  }
  if (category === 'shoes') return ['LeftFoot', 'RightFoot'];
  return ['Head', 'Chest', 'LeftHand', 'RightHand'];
}

function attachBoneFor(category: AvatarOutfitCategory) {
  if (category === 'shoes') return 'LeftFoot';
  if (category === 'accessory') return 'Chest';
  return undefined;
}

export class ProductToOutfitProvider {
  fromProduct(item: StoreItem, assetUrl?: string): AvatarOutfit {
    const category = item.category as AvatarOutfitCategory;
    const fittingMode = fittingModeFor(category);

    return {
      id: `outfit-${item.id}`,
      productId: item.id,
      name: item.name,
      brand: item.brand,
      category,
      previewImage: item.imageUrl,
      assetUrl,
      assetFormat: assetUrl ? 'glb' : 'procedural-proxy',
      compatibleAvatarType: 'stylized-humanoid-lite',
      fittingMode,
      skeletonCompatibility: {
        boneMapVersion: 'humanoid-lite-v0.1',
        requiredBones: requiredBonesFor(category),
        attachBone: attachBoneFor(category),
      },
      materialConfig: {
        baseColor: firstColorHex(item),
        secondaryColor: secondaryColorHex(item),
        trimColor: trimColorFor(category),
        textureUrl: item.imageUrl,
        toonShading: true,
        outline: true,
      },
      source: 'mock-product',
      providerStage: assetUrl ? 'real-asset' : 'proxy-from-product',
    };
  }
}

export class RealGarmentProvider implements AvatarOutfitProvider {
  private productProvider = new ProductToOutfitProvider();

  async listDemoOutfits(): Promise<AvatarOutfit[]> {
    const items = await getMockItems();
    const realItems = Object.keys(REAL_GARMENT_ASSETS)
      .map((id) => items.find((item) => item.id === id))
      .filter(Boolean) as StoreItem[];
    return realItems.map((item) => this.productProvider.fromProduct(item, REAL_GARMENT_ASSETS[item.id]));
  }

  async resolve(productId: string): Promise<AvatarOutfit> {
    const items = await getMockItems();
    const item = items.find((candidate) => candidate.id === productId);
    if (!item) throw new Error(`Product not found for outfit: ${productId}`);
    return this.productProvider.fromProduct(item, REAL_GARMENT_ASSETS[item.id]);
  }
}

export class ProceduralProxyOutfitProvider implements AvatarOutfitProvider {
  private productProvider = new ProductToOutfitProvider();

  async listDemoOutfits(): Promise<AvatarOutfit[]> {
    const items = await getMockItems();
    const selected: StoreItem[] = [];

    for (const category of CATEGORY_PRIORITY) {
      const item = items.find((candidate) => candidate.category === category && candidate.stockStatus !== 'out_of_stock');
      if (item) selected.push(item);
      if (selected.length >= 3) break;
    }

    return selected.map((item) => this.productProvider.fromProduct(item, REAL_GARMENT_ASSETS[item.id]));
  }

  async resolve(productId: string): Promise<AvatarOutfit> {
    const items = await getMockItems();
    const item = items.find((candidate) => candidate.id === productId);
    if (!item) throw new Error(`Product not found for outfit: ${productId}`);
    return this.productProvider.fromProduct(item, REAL_GARMENT_ASSETS[item.id]);
  }
}

export class FutureRealGarmentProvider implements AvatarOutfitProvider {
  async listDemoOutfits(): Promise<AvatarOutfit[]> {
    return [];
  }

  async resolve(_productId: string): Promise<AvatarOutfit> {
    throw new Error('FutureRealGarmentProvider is reserved for real GLB garment assets');
  }
}

export const avatarOutfitProvider = new RealGarmentProvider();
