/**
 * 日期工具函数
 */

/** 获取今日日期字符串 YYYY-MM-DD */
export function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

/** 获取昨日日期 */
export function getYesterday(date?: string): string {
  const d = date ? new Date(date) : new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

/** 判断两个日期是否为连续天 */
export function isConsecutiveDay(date1: string, date2: string): boolean {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diff = d2.getTime() - d1.getTime();
  const oneDay = 24 * 60 * 60 * 1000;
  return Math.abs(diff - oneDay) < 1000; // 容忍 1s 误差
}

/** 格式化日期为中文 */
export function formatDateCN(date: string): string {
  const d = new Date(date);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  const weekday = weekdays[d.getDay()];
  return `${month}月${day}日 周${weekday}`;
}

/** 获取月份的所有日期 */
export function getMonthDays(year: number, month: number): (string | null)[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPadding = firstDay.getDay();
  const days: (string | null)[] = [];

  for (let i = 0; i < startPadding; i++) {
    days.push(null);
  }

  for (let d = 1; d <= lastDay.getDate(); d++) {
    const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    days.push(date);
  }

  return days;
}

/** 计算连续打卡天数 */
export function calculateStreak(diary: Record<string, unknown>, lastOpenDate: string): number {
  const today = getToday();
  if (!lastOpenDate) return 0;

  // 今天已经打过卡了
  if (lastOpenDate === today) {
    // 检查从昨天往前连续的天数
    let streak = 1;
    let checkDate = getYesterday(today);
    while (diary[checkDate]) {
      streak++;
      checkDate = getYesterday(checkDate);
    }
    return streak;
  }

  // 昨天打过卡
  if (lastOpenDate === getYesterday(today)) {
    let streak = 1;
    let checkDate = getYesterday(lastOpenDate);
    while (diary[checkDate]) {
      streak++;
      checkDate = getYesterday(checkDate);
    }
    return streak;
  }

  // 断签了
  return diary[today] ? 1 : 0;
}
