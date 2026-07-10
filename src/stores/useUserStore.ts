import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserProfile, StyleTag, ColorPreference, BodyType } from '@/types';

interface UserState {
  profile: UserProfile | null;
  isOnboarded: boolean;
  setProfile: (profile: UserProfile) => void;
  updateStyleProfile: (updates: {
    bodyType?: BodyType;
    styleTags?: StyleTag[];
    colorPreferences?: ColorPreference[];
    preferredStore?: string;
  }) => void;
  clearProfile: () => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      profile: null,
      isOnboarded: false,

      setProfile: (profile) =>
        set({ profile, isOnboarded: true }),

      updateStyleProfile: (updates) =>
        set((state) => ({
          profile: state.profile
            ? {
                ...state.profile,
                bodyType: updates.bodyType ?? state.profile.bodyType,
                styleTags: updates.styleTags ?? state.profile.styleTags,
                colorPreferences:
                  updates.colorPreferences ?? state.profile.colorPreferences,
                preferredStore:
                  updates.preferredStore ?? state.profile.preferredStore,
              }
            : null,
        })),

      clearProfile: () =>
        set({ profile: null, isOnboarded: false }),
    }),
    { name: 'aimm-user' }
  )
);
