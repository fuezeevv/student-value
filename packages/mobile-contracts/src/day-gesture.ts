/** Horizontal navigation commits once, after an intentional one-finger gesture.
 * dx/dy are logical points; vx is points per millisecond (RN PanResponder).
 */
export function daySwipeDirection(gesture: {
  dx: number;
  dy: number;
  vx: number;
}): -1 | 0 | 1 {
  const { dx, dy, vx } = gesture;
  if (![dx, dy, vx].every(Number.isFinite)) return 0;
  if (Math.abs(dx) < 32 || Math.abs(dx) <= Math.abs(dy) * 1.7) return 0;
  if (Math.abs(dx) < 72 && Math.abs(vx) < 0.55) return 0;
  return dx < 0 ? 1 : -1;
}
