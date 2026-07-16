/**
 * 埋点工具（桩代码）
 * 后续接入银泰实际埋点系统
 */

type EventName =
  | 'page_view'
  | 'outfit_generate'
  | 'outfit_save'
  | 'outfit_share'
  | 'challenge_create'
  | 'challenge_join'
  | 'challenge_vote'
  | 'store_view'
  | 'purchase_click'
  | 'coupon_redeem'
  | 'onboarding_complete'
  | 'streak_milestone'
  | 'daily_quest_view'
  | 'daily_quest_start'
  | 'daily_quest_identity_upload'
  | 'daily_quest_select'
  | 'daily_quest_complete'
  | 'daily_quest_share'
  | 'daily_quest_friend_join'
  | 'daily_quest_publication_toggle'
  | 'daily_quest_store_unlock';

interface EventParams {
  [key: string]: string | number | boolean;
}

export function track(event: EventName, params?: EventParams): void {
  if (import.meta.env.DEV) {
    console.log(`[Analytics] ${event}`, params || '');
  }

  // TODO: 接入银泰埋点 SDK
  // window._intimeTracker?.track(event, params);

  // 本地记录供演示
  try {
    const stored = JSON.parse(localStorage.getItem('aimm-analytics') || '[]');
    stored.push({ event, params, timestamp: Date.now() });
    if (stored.length > 500) stored.shift();
    localStorage.setItem('aimm-analytics', JSON.stringify(stored));
  } catch {
    // ignore
  }
}

export function getAnalyticsLog(): Array<{ event: string; params?: EventParams; timestamp: number }> {
  try {
    return JSON.parse(localStorage.getItem('aimm-analytics') || '[]');
  } catch {
    return [];
  }
}
