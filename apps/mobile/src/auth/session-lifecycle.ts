// Async work may only publish data while its originating login is current.
let generation = 0;
let controller = new AbortController();
export function sessionGeneration() {
  return generation;
}
export function sessionSignal() {
  return controller.signal;
}
export function invalidateSessionWork() {
  generation++;
  controller.abort();
  controller = new AbortController();
}
export function isCurrentSession(value: number) {
  return value === generation;
}
