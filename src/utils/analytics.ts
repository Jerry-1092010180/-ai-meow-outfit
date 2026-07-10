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
  | 'streak_milestone';

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
