// 疎結合のためのごく小さなイベントバス。
// 例: stats が「ステが伸びた」を emit → ui が通知バナーを出す（stats は ui を知らない）。
const handlers = new Map();

export function on(type, fn) {
  if (!handlers.has(type)) handlers.set(type, new Set());
  handlers.get(type).add(fn);
  return () => handlers.get(type).delete(fn);
}

export function emit(type, payload) {
  for (const fn of handlers.get(type) || []) fn(payload);
}
