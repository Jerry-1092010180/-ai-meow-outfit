export interface UserProfile {
  id: string;
  miaojieMemberId: string;
  nickname: string;
  avatar: string;
  bodyType: BodyType;
  height: number;
  preferredStore: string;
  styleTags: StyleTag[];
  colorPreferences: ColorPreference[];
  onboardedAt: string;
}

export type BodyType = 'apple' | 'pear' | 'hourglass' | 'rectangle' | 'inverted_triangle';

export type StyleTag = 'minimalist' | 'street' | 'elegant' | 'vintage' | 'sporty' | 'romantic' | 'business' | 'korean';

export type ColorPreference = 'warm' | 'cool' | 'neutral' | 'monochrome' | 'vibrant';

export interface StyleProfile {
  bodyType: BodyType;
  styleTags: StyleTag[];
  colorPreferences: ColorPreference[];
  height: number;
  preferredStore: string;
}
