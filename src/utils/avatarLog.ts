/**
 * Avatar Pipeline 统一日志工具
 *
 * 格式: [Avatar] EventName Detail
 * 异常: [Avatar] EventName FAILED reason
 */
const PREFIX = '[Avatar]';

export function avatarLog(event: string, detail?: string) {
  const msg = detail ? `${PREFIX} ${event} ${detail}` : `${PREFIX} ${event}`;
  console.log(msg);
}

export function avatarError(event: string, error: unknown) {
  const err = error as any;
  console.error(
    `${PREFIX} ${event} FAILED`,
    err?.message || err,
    err?.status ? `HTTP ${err.status}` : '',
    err?.stack ? `\n${err.stack}` : ''
  );
}
