// ── Route paths ──
export const ROUTES = {
  HOME: '/',
  ONBOARDING: '/onboarding',
  DIARY: '/diary',
  CHALLENGES: '/challenges',
  CHALLENGE_DETAIL: '/challenges/:id',
  SHARE: '/share/:outfitId',
  TRY_ON: '/try-on',
  CHALLENGE_3D: '/challenges/:id/3d',
  JOIN_CHALLENGE: '/challenges/join/:code',
  STORE: '/store',
  PROFILE: '/profile',
} as const;
