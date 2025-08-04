/**
 * server/directions.ts
 * @fileoverview Manages direction-related logic for TextBound Castle Crawl.
 * This includes defining canonical directions, normalizing player input into
 * these canonical forms, and building comprehensive exit maps for game nodes
 * by incorporating various synonyms.
 *
 * @author Walter Conley
 * @date July 25, 2025:
 *    - Added direction normalization and exit map building functions
 *    - Added direction synonyms (ex. east = right, e, or r)
 *    - Added coordinates inferring function
 * @version 1.0.0
 */
import type { Level, CanonDir, ExitKey } from "./types.ts"; // Import the new types

/**
 * Defines the canonical (full word) directions used in the game.
 * These are the primary directions.
 */
export const CANON_DIRS: CanonDir[] = ["north", "south", "east", "west"];

/**
 * Defines how each direction changes coordinates (x, y)
 * N is +Y and E is +X
 */
const DIR_TO_COORD_DELTA: Map<CanonDir, { dx: number; dy: number }> = new Map([
  ["north", { dx: 0, dy: 1 }],
  ["south", { dx: 0, dy: -1 }],
  ["east", { dx: 1, dy: 0 }],
  ["west", { dx: -1, dy: 0 }],
]);

/**
 * Maps all user input (lowercase) to their canonical (lowercase) direction.
 */
const DirectionSynonyms: Map<string, CanonDir> = new Map<string, CanonDir>([
  ["north", "north"],
  ["n", "north"],
  ["south", "south"],
  ["s", "south"],
  ["east", "east"],
  ["e", "east"],
  ["right", "east"],
  ["west", "west"],
  ["w", "west"],
  ["left", "west"],
  ["up", "north"],
  ["u", "north"],
  ["down", "south"],
  ["d", "south"],
]);

/* * Normalizes a player's raw direction input into a canonical direction string.
 * Returns null if the input is not recognized.
 */
export function normalizeDirectionInput(input: string): CanonDir | null {
  return DirectionSynonyms.get(input.toLowerCase()) || null;
}

// --- Helper for building the full exits map for Node objects ---

/**
 * Defines additional synonyms for canonical directions that will be added to the exits map.
 * Key: CanonicalDirection (lowercase)
 * Value: Array of ExitKey (lowercase synonyms)
 */
const ExitSynonyms: Map<CanonDir, ExitKey[]> = new Map<CanonDir, ExitKey[]>([
  // Explicitly assert type here
  ["east", ["e", "right", "r"]],
  ["west", ["w", "left", "l"]],
  ["north", ["n", "up", "u"]],
  ["south", ["s", "down", "d"]],
]);

/**
 * Builds a comprehensive exits Map for a Node, including canonical directions and their specified synonyms.
 * This is used during initial Castle creation to populate the Node.exits map.
 * @param canonExits A Map where keys are CanonDir (lowercase) and values are target room names.
 * @returns A Map<ExitKey, string> containing all keys (canonical + synonyms) mapped to the room names.
 */
export function buildExits(
  canonExits: Map<CanonDir, string>,
): Map<ExitKey, string> {
  // Renamed to buildExits
  const fullExits = new Map<ExitKey, string>();
  canonExits.forEach((targetRoom, canonDir) => {
    fullExits.set(canonDir, targetRoom);

    const synonyms = ExitSynonyms.get(canonDir); // Using ExitSynonyms
    if (synonyms) {
      synonyms.forEach((syn) => {
        fullExits.set(syn, targetRoom);
      });
    }
  });
  return fullExits;
}

/**
 * Infers (x,y) coordinates for nodes in the level based on canonical exits,
 * Assigns the specified `startNodeName` to (0,0) as a reference point.
 * Modifies the LevelNode objects in the provided `level` Map in place
 * by setting their `x` and `y` properties.
 *
 * @param level The Level map (Map<string, LevelNode>) to infer coordinates for.
 * @param startNodeName The name of the node to assign (0,0) coordinates to.
 * @returns A Set of node names that could not be reached and thus not placed (disconnected parts of the graph).
 */
export function inferNodeCoordinates(
  level: Level,
  startNodeName: string = "Barbican", // Default to Barbican as it's a good central starting point
): Set<string> {
  const assignedCoords = new Map<string, { x: number; y: number }>();
  const queue: { nodeName: string; x: number; y: number }[] = [];
  // Initially, all nodes are unplaced. We'll remove them as we place them.
  const unplacedNodes = new Set(level.keys());

  // 1. Initialize the starting node
  if (level.has(startNodeName)) {
    assignedCoords.set(startNodeName, { x: 0, y: 0 });
    queue.push({ nodeName: startNodeName, x: 0, y: 0 });
    unplacedNodes.delete(startNodeName); // Mark as placed
  } else {
    console.warn(
      `Starting node '${startNodeName}' not found in level. Coordinates cannot be inferred.`,
    );
    return unplacedNodes; // No starting point, so nothing inferred.
  }

  let head = 0;
  while (head < queue.length) {
    const { nodeName, x, y } = queue[head++];
    const currentNode = level.get(nodeName);

    if (!currentNode) {
      // This should ideally not happen if queue only contains valid node names
      console.error(
        `Error: Node "${nodeName}" from queue not found in level map.`,
      );
      continue;
    }

    // 2. "Pin" the coordinates to the actual LevelNode object
    currentNode.x = x;
    currentNode.y = y;

    // 3. Explore neighbors
    for (const [dirKey, targetNodeName] of currentNode.exits.entries()) {
      // We only use canonical directions for coordinate inference
      const canonDir = dirKey as CanonDir;

      if (DIR_TO_COORD_DELTA.has(canonDir)) {
        const { dx, dy } = DIR_TO_COORD_DELTA.get(canonDir)!;
        const newX = x + dx;
        const newY = y + dy;

        // If the target node hasn't been assigned coordinates yet
        if (!assignedCoords.has(targetNodeName)) {
          assignedCoords.set(targetNodeName, { x: newX, y: newY });
          queue.push({ nodeName: targetNodeName, x: newX, y: newY });
          unplacedNodes.delete(targetNodeName); // Mark as placed
        } else {
          // IMPORTANT: Consistency check for graphs that might not be perfect grids
          const existingCoords = assignedCoords.get(targetNodeName)!;
          if (existingCoords.x !== newX || existingCoords.y !== newY) {
            console.warn(
              `Coordinate conflict for node '${targetNodeName}': ` +
                `Reached via ${nodeName} (${x},${y}) + ${canonDir} -> (${newX}, ${newY}), ` +
                `but previously assigned (${existingCoords.x}, ${existingCoords.y}). ` +
                `This level might not conform to a strict 2D grid.`,
            );
            // TODO: Think more on below
            // Thought of adding moving rooms like Harry Potter staircase
            // But I don't want to account for this here! D:
          }
        }
      }
    }
  }
  return unplacedNodes; // Contains nodes that were in the level map but not reachable
}
