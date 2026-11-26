import { describe, it, expect } from "vitest";
import {
  indoorRoute,
  type IndoorNode,
} from "../packages/mobile-contracts/src/indoor-route";
import graph from "../apps/mobile/assets/indoor/main-building.json";
describe("sourced main-building graph", () => {
  it("has no dangling connections and finds a room-to-room route through actual stairs", () => {
    const nodes: IndoorNode[] = graph.nodes;
    const ids = new Set(nodes.map((n) => n.id));
    expect(nodes.every((n) => n.neighbours.every((id) => ids.has(id)))).toBe(
      true,
    );
    const start = nodes.find((n) => !n.intermediate && n.floor === 1)!;
    const finish = nodes.find((n) => !n.intermediate && n.floor === 3)!;
    const path = indoorRoute(nodes, start.id, finish.id);
    expect(path.length).toBeGreaterThan(2);
    expect(path[0].id).toBe(start.id);
    expect(path.at(-1)?.id).toBe(finish.id);
    for (let i = 1; i < path.length; i++) {
      expect(path[i - 1].neighbours).toContain(path[i].id);
      if (path[i].floor !== path[i - 1].floor)
        expect(path[i].stairs && path[i - 1].stairs).toBe(true);
    }
  });
  it("rejects unknown endpoints rather than drawing an invented straight line", () => {
    expect(indoorRoute(graph.nodes, "unknown", graph.nodes[0].id)).toEqual([]);
  });
});
