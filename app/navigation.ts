export type GroundPoint = { x: number; z: number };
export type Obstacle = GroundPoint & { w: number; d: number };

const distance = (a: GroundPoint, b: GroundPoint) => Math.hypot(a.x - b.x, a.z - b.z);
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function createNavigation(obstacles: Obstacle[]) {
  const walls = obstacles.map((wall) => ({
    left: wall.x - wall.w / 2 - .15, right: wall.x + wall.w / 2 + .15,
    back: wall.z - wall.d / 2 - .15, front: wall.z + wall.d / 2 + .15,
  }));
  const isWalkable = (point: GroundPoint) => Math.abs(point.x) < 38.5 && Math.abs(point.z) < 33.5
    && !walls.some((wall) => point.x > wall.left && point.x < wall.right && point.z > wall.back && point.z < wall.front);

  // Test the whole segment so a route cannot cut through a narrow wall or bed.
  function clearSegment(from: GroundPoint, to: GroundPoint) {
    return !walls.some((wall) => {
      let enter = 0, exit = 1;
      for (const [start, delta, min, max] of [
        [from.x, to.x - from.x, wall.left, wall.right],
        [from.z, to.z - from.z, wall.back, wall.front],
      ]) {
        if (Math.abs(delta) < 1e-9) {
          if (start <= min || start >= max) return false;
        } else {
          const a = (min - start) / delta, b = (max - start) / delta;
          enter = Math.max(enter, Math.min(a, b)); exit = Math.min(exit, Math.max(a, b));
          if (enter >= exit) return false;
        }
      }
      return enter < exit && exit > 0 && enter < 1;
    });
  }

  const corners = walls.flatMap((wall) => [
    { x: wall.left - .03, z: wall.back - .03 }, { x: wall.right + .03, z: wall.back - .03 },
    { x: wall.left - .03, z: wall.front + .03 }, { x: wall.right + .03, z: wall.front + .03 },
  ]).filter(isWalkable);

  function findPath(from: GroundPoint, destination: GroundPoint): GroundPoint[] {
    if (!Number.isFinite(destination.x) || !Number.isFinite(destination.z)) return [];
    let goal = { x: clamp(destination.x, -38.45, 38.45), z: clamp(destination.z, -33.45, 33.45) };
    if (!isWalkable(goal)) {
      // A tap on a table or tree ends on the nearest available ground beside it.
      const candidates = walls.flatMap((wall) => [
        { x: wall.left - .03, z: clamp(goal.z, wall.back - .03, wall.front + .03) },
        { x: wall.right + .03, z: clamp(goal.z, wall.back - .03, wall.front + .03) },
        { x: clamp(goal.x, wall.left - .03, wall.right + .03), z: wall.back - .03 },
        { x: clamp(goal.x, wall.left - .03, wall.right + .03), z: wall.front + .03 },
      ]).filter(isWalkable);
      candidates.sort((a, b) => distance(a, goal) - distance(b, goal) || distance(a, from) - distance(b, from));
      if (!candidates.length) return [];
      goal = candidates[0];
    }
    if (!isWalkable(from)) return [];
    if (clearSegment(from, goal)) return [goal];

    const points = [from, goal, ...corners], open = new Set([0]), visited = new Set<number>();
    const costs = points.map(() => Infinity), previous = points.map(() => -1);
    costs[0] = 0;
    while (open.size) {
      let current = -1, best = Infinity;
      for (const index of open) {
        const estimate = costs[index] + distance(points[index], goal);
        if (estimate < best) { best = estimate; current = index; }
      }
      if (current === 1) {
        const path = [];
        for (let index = 1; index !== 0; index = previous[index]) path.unshift(points[index]);
        return path;
      }
      open.delete(current); visited.add(current);
      points.forEach((point, index) => {
        if (visited.has(index)) return;
        const cost = costs[current] + distance(points[current], point);
        if (cost >= costs[index] || !clearSegment(points[current], point)) return;
        costs[index] = cost; previous[index] = current; open.add(index);
      });
    }
    return [];
  }

  return { isWalkable, findPath };
}
