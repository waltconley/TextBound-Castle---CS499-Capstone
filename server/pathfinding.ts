/**
 * server/pathfinding.ts
 * @fileoverview Implements the pathfinding algorithm for TextBound Castle Crawl.
 * This file provides the `findPath` function, which calculates the cheapest
 * path between two nodes in the game's level graph using a variation
 * of the A* algorithm (effectively Dijkstra's, as it uses a zero heuristic).
 * Path cost is determined by the 'size' property of each node.
 *
 * @author Walter Conley
 * @date July 23, 2025 - Initial creation
 * @date July 23, 2025 - Implemented A* (Dijkstra's) algorithm for weighted pathfinding
 * @date July 24, 2025 - Modified to return detailed path segments including directions
 * @date July 25, 2025 - Added Heuristic func to make it truly A*
 * @date August 1, 2025 - Cleaned up comments, couldn't get links working in nvim
 * @version 1.0.0
 */

// Import necessary types from types.ts
import type {
  Result,
  PotentialPathingError,
  Level,
  LevelNode,
  PathSegment,
  CanonDir,
} from "./types.ts";
import {
  StartOrEndNodeNotFoundError,
  NoPathFoundError,
  InternalGraphConsistencyError,
} from "./error.ts";
import { CANON_DIRS } from "./directions.ts";

/**
 * Priority Queue class for pathfinding
 *
 */
class PriorityQueue<T> {
  private elements: { item: T; priority: number }[] = [];

  // We're just sorting since our levels are small
  // In bigger levels, a binary tree would be better
  enqueue(item: T, priority: number): void {
    this.elements.push({ item, priority });
    this.elements.sort((a, b) => a.priority - b.priority);
  }

  dequeue(): T | undefined {
    return this.elements.shift()?.item;
  }

  isEmpty(): boolean {
    return this.elements.length === 0;
  }
}

/**
 * Calculates heuristic (estimated cost) from 'fromNodeName' to 'toNodeName'
 * using Manhattan distance based on inferred (x, y) coords
 *
 * @param fromNodeName  The name of the current node
 * @param toNodeName    The name of the goal node
 * @param level         The entire level containing nodes
 * @returns The estimated cost (Manhatten distance), or 0 if coords are missing
 */
function getHeuristic(
  fromNodeName: string,
  toNodeName: string,
  level: Level,
): number {
  const fromNode = level.get(fromNodeName);
  const toNode = level.get(toNodeName);

  // Ensure both nodes exist and got coords
  if (
    fromNode?.x !== undefined &&
    fromNode?.y !== undefined &&
    toNode?.x !== undefined &&
    toNode?.y !== undefined
  ) {
    // Formula: |x1 - x2| + |y1 - y2|
    return Math.abs(fromNode.x - toNode.x) + Math.abs(fromNode.y - toNode.y);
  }

  // Fallback
  return 0;
}

/**
 * Finds cheapest path between rooms using A*
 * Cost is determined by roomSize field for each node/room.
 * I'm just going to use 1 for every room.
 * @param level     The entire level
 * @param sNode     The starting node/room
 * @param eNode     The target node/room
 * @returns A Result object:
 * - Success containing an array of PathSegment on successful pathfinding.
 * - Failure containing a PotentialPathingError if the path cannot be found
 * or if input nodes are invalid.
 */
export function findPath(
  level: Level,
  sNode: string,
  eNode: string,
): Result<PathSegment[], PotentialPathingError> {
  // Make sure we aren't traveling to current location
  if (sNode == eNode) {
    return {
      data: [{ nodeName: sNode, directionFromPrevious: null }],
      error: null,
    };
  }

  // Make sure the level has starting node and ending node
  if (!level.has(sNode) || !level.has(eNode)) {
    return {
      data: null,
      error: new StartOrEndNodeNotFoundError(
        `Start node "${sNode}" or End node "${eNode}" not found in level.`,
      ),
    };
  }

  const possibilities = new PriorityQueue<string>(); // Nodes to explore, sorted by f_score (g + h)
  const cameFrom = new Map<string, string | null>(); // How we got to each node
  const gScore = new Map<string, number>(); // Actual cost from start to current node (g(n))

  // Initialize our pathfinding!
  possibilities.enqueue(sNode, 0 + getHeuristic(sNode, eNode, level));
  cameFrom.set(sNode, null);
  gScore.set(sNode, 0);

  // Main A* Loop
  while (!possibilities.isEmpty()) {
    const curNodeName = possibilities.dequeue()!; // Get lowest cost room

    // If we've already found a cheaper path to this node, skip it
    // Happens if node has multiple f_scores, A* efficiancy!
    if (curNodeName === eNode) {
      break;
    }

    // Not really needed for hardcoded levels, but dynamic levels!
    const curNode: LevelNode | undefined = level.get(curNodeName);
    if (!curNode) {
      return {
        data: null,
        error: new InternalGraphConsistencyError(
          `Node "${curNodeName}" was in the priority queue but not found in the level map.`,
        ),
      };
    }

    // Check neighbors
    for (const nextNodeName of curNode.exits.values()) {
      const nextNode: LevelNode | undefined = level.get(nextNodeName);
      if (!nextNode) {
        // This indicates an internal inconsistency: an exit points to a non-existent node.
        return {
          data: null,
          error: new InternalGraphConsistencyError(
            `Exit from "${curNodeName}" leads to an unknown node "${nextNodeName}".`,
          ),
        };
      }

      // Calculate tentative g_score (actual cost from start to nextNode via curNode)
      // cost: curNode -> nextNode = nextNode.size (or 1)
      const costToMove = nextNode.size ?? 1;
      const tentative_gScore = gScore.get(curNodeName)! + costToMove;

      // If this path to nextNode is better than any previous one found
      if (
        !gScore.has(nextNodeName) ||
        tentative_gScore < gScore.get(nextNodeName)!
      ) {
        cameFrom.set(nextNodeName, curNodeName); // Record the best predecessor
        gScore.set(nextNodeName, tentative_gScore); // Update the cost

        // f_score: g_score + h_score
        const fScore =
          tentative_gScore + getHeuristic(nextNodeName, eNode, level);
        possibilities.enqueue(nextNodeName, fScore); // Add to priority queue with its f_score
      }
    }
  }

  // Reconstruct path if found
  if (!cameFrom.has(eNode)) {
    return {
      data: null,
      error: new NoPathFoundError(
        `No path found from "${sNode}" to "${eNode}".`,
      ),
    };
  }

  const path: string[] = [];
  let current: string | null = eNode;
  while (current !== null) {
    path.unshift(current); // Add to beginning of array
    current = cameFrom.get(current)!; // Move to the predecessor
  }

  const detailedPath: PathSegment[] = [];

  for (let i = 0; i < path.length; i++) {
    const segment: PathSegment = {
      nodeName: path[i],
      directionFromPrevious: null, // First segment
    };

    if (i > 0) {
      // Anything after first segment
      const previousNodeName = path[i - 1];
      const currentNodeName = path[i];

      const previousNode: LevelNode | undefined = level.get(previousNodeName);

      if (previousNode) {
        // Find the direction from previousNode to currentNodeName
        let foundDirection: string | undefined;
        for (const [dirKey, targetRoom] of previousNode.exits.entries()) {
          if (targetRoom === currentNodeName) {
            // Just use canonical directions
            if (CANON_DIRS.includes(dirKey as CanonDir)) {
              foundDirection = dirKey;
              break;
            }
            // Canonical not found, use whatever found?
            if (!foundDirection) {
              foundDirection = dirKey;
            }
          }
        }
        segment.directionFromPrevious = foundDirection || null;
      } else {
        // Redundant check, but good for dynamic levels
        return {
          data: null,
          error: new InternalGraphConsistencyError(
            `Path reconstruction error: Previous node "${previousNodeName}" not found in level map.`,
          ),
        };
      }
    }
    detailedPath.push(segment);
  }

  // If we reached here, a path was successfully found and reconstructed.
  return { data: detailedPath, error: null }; // Return a Success object.
}
