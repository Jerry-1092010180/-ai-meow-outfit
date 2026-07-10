/**
 * 深度链接工具
 * 生成喵街 APP 的 scheme 链接和 Universal Link
 */

const MIAOJIE_SCHEME = 'miaojie://';
const H5_BASE_URL = 'https://m.intime.com.cn/aimm';

/** 生成喵街 scheme 链接 */
export function buildSchemeLink(outfitId: string): string {
  return `${MIAOJIE_SCHEME}outfit?id=${outfitId}`;
}

/** 生成分享用 H5 链接 */
export function buildShareLink(outfitId: string, inviterId?: string): string {
  const params = new URLSearchParams({ id: outfitId });
  if (inviterId) params.set('inviter', inviterId);
  return `${H5_BASE_URL}/share?${params.toString()}`;
}

/** 生成挑战邀请链接 */
export function buildChallengeLink(challengeId: string, inviterId: string): string {
  const params = new URLSearchParams({ challenge: challengeId, inviter: inviterId });
  return `${MIAOJIE_SCHEME}challenge/join?${params.toString()}`;
}

/** 生成二维码内容（用于海报） */
export function buildQRContent(outfitId: string, inviterId?: string): string {
  return buildShareLink(outfitId, inviterId);
}

/** 复制到剪贴板 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for older browsers
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    return success;
  }
}
