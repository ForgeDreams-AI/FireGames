// Pathfinder.js — tiny BFS over a tile grid. Content-free; used by the scenes
// for tap/click-to-move. Returns the list of tiles to step onto (excluding the
// start), in order, or null if the goal is unreachable.

export function bfsPath(width, height, passable, start, goal) {
  if (start.x === goal.x && start.y === goal.y) return [];
  if (!passable(goal.x, goal.y)) return null;
  const key = (x, y) => x + ',' + y;
  const prev = {};
  prev[key(start.x, start.y)] = null;
  const queue = [start];
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  while (queue.length) {
    const c = queue.shift();
    for (let d = 0; d < dirs.length; d++) {
      const nx = c.x + dirs[d][0], ny = c.y + dirs[d][1], k = key(nx, ny);
      if (k in prev) continue;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      if (!passable(nx, ny)) continue;
      prev[k] = { x: c.x, y: c.y };
      if (nx === goal.x && ny === goal.y) {
        const path = [];
        let cur = { x: nx, y: ny };
        while (cur && !(cur.x === start.x && cur.y === start.y)) { path.unshift(cur); cur = prev[key(cur.x, cur.y)]; }
        return path;
      }
      queue.push({ x: nx, y: ny });
    }
  }
  return null;
}

// Shortest path that ENDS on a tile adjacent to `target` (for tap-to-interact
// with a blocked object like an NPC or the RTO). Returns { path, from } or null.
export function bfsAdjacent(width, height, passable, start, target) {
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  let best = null;
  for (let d = 0; d < dirs.length; d++) {
    const gx = target.x + dirs[d][0], gy = target.y + dirs[d][1];
    if (gx < 0 || gy < 0 || gx >= width || gy >= height) continue;
    if (!passable(gx, gy)) continue;
    const p = bfsPath(width, height, passable, start, { x: gx, y: gy });
    if (p && (!best || p.length < best.length)) best = p;
  }
  return best;
}
