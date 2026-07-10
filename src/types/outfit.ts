export interface GeneratedOutfit {
  id: string;
  date: string;
  name: string;
  mood: Mood;
  weather: WeatherContext;
  pieces: OutfitPiece[];
  styleDescription: string;
  sceneImage: string;
  posterImage?: string;
  linkedItems: LinkedStoreItem[];
  styleScore: number;
  tags: string[];
  createdAt: string;
}

export type Mood = 'happy' | 'calm' | 'energetic' | 'chill' | 'romantic' | 'confident';

export interface OutfitPiece {
  type: PieceType;
  name: string;
  description: string;
  color: string;
  material: string;
  storeItemId?: string;
}

export type PieceType = 'top' | 'bottom' | 'dress' | 'outerwear' | 'shoes' | 'accessory';

export interface WeatherContext {
  temperature: number;
  condition: WeatherCondition;
  city: string;
  season: Season;
  humidity: number;
}

export type WeatherCondition = 'sunny' | 'cloudy' | 'rainy' | 'snowy' | 'windy';

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

export interface LinkedStoreItem {
  id: string;
  name: string;
  brand: string;
  price: number;
  imageUrl: string;
  storeId: string;
  storeName: string;
}
