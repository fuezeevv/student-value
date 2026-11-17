export type IndoorNode = {
  id: string;
  room: string;
  floor: number;
  x: number;
  y: number;
  neighbours: string[];
  intermediate: boolean;
  stairs: boolean;
};
/** Shortest route on the published graph. A floor change is only possible at
 * explicit staircase links; this is not an accessible/evacuation route. */
export function indoorRoute(
  nodes: IndoorNode[],
  from: string,
  to: string,
): IndoorNode[] {
  const graph = new Map(nodes.map((n) => [n.id, n]));
  if (!graph.has(from) || !graph.has(to)) return [];
  const distance = new Map<string, number>([[from, 0]]);
  const previous = new Map<string, string>();
  const remaining = new Set(graph.keys());
  while (remaining.size) {
    let current: string | undefined;
    let best = Infinity;
    for (const id of remaining) {
      const value = distance.get(id) ?? Infinity;
      if (value < best) {
        current = id;
        best = value;
      }
    }
    if (!current) return [];
    remaining.delete(current);
    if (current === to) {
      const route: IndoorNode[] = [];
      let cursor: string | undefined = to;
      while (cursor) {
        route.unshift(graph.get(cursor)!);
        cursor = previous.get(cursor);
      }
      return route;
    }
    const node = graph.get(current)!;
    for (const id of node.neighbours) {
      const next = graph.get(id);
      if (!next || !remaining.has(id)) continue;
      if (next.floor !== node.floor && (!node.stairs || !next.stairs)) continue;
      const cost =
        next.floor === node.floor
          ? Math.max(1, Math.hypot(node.x - next.x, node.y - next.y))
          : 400;
      if (best + cost < (distance.get(id) ?? Infinity)) {
        distance.set(id, best + cost);
        previous.set(id, current);
      }
    }
  }
  return [];
}
