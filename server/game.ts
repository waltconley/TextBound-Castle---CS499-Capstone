/**
 * /server/game.ts (server)
 * @fileoverview Defines the core game logic and data structures for TextBound Castle Crawl.
 * This file manages the game state, room definitions, item interactions,
 * and conditions for winning or losing the game.
 *
 * @author Walter Conley
 * @date July 17, 2025 - Initial creation, converted from python
 * @date July 18, 2025 - Added game phase and refined game state management and display logic
 * @date July 24, 2025:
 *    - Refactored levels to graph representation (when enables A* pathfinding)
 *    - Refactored inventory to hash tables
 *    - Added direction synonyms when constructing level.
 * @date July 25, 2025:
 *    - Moved types/interfaces to their own file (types.ts)
 *    - Infers coordinate system based on level layout (for pathfinding)
 * @date August 1, 2025:
 *    - Refined the game ending logic to account for other levels
 *    - Removed the getIntro() and getHelp() functions in favor of dynamic data
 *    - Refined game state to account for persistent data
 * @version 1.0.4
 */

import { db } from "./db/index.ts";
import { levels, gameStates } from "./db/schema.ts";
import { eq } from "drizzle-orm";
import type { InferInsertModel } from "drizzle-orm";

import type {
  LevelNode,
  Level,
  GameState,
  CanonDir,
  Result,
  GameStateError,
  LevelStatus,
} from "./types.ts";
import { tryCatch } from "./types.ts";
import { LevelInitializationError, InvalidGameStateError } from "./error.ts";
import { normalizeDirectionInput, buildExits } from "./directions.ts";
import { CANON_DIRS, inferNodeCoordinates } from "./directions.ts";

type GameStateInsert = InferInsertModel<typeof gameStates>;

/**
 * Saves the user's current game state to the database.
 * @param {number} userId - The ID of the user.
 * @param {GameState} gameState - The current game state object.
 * @returns {Promise<void>}
 */
export async function saveGameState(
  userId: number,
  gameState: GameState,
): Promise<void> {
  // Convert Maps to plain objects
  const inventoryObject = Object.fromEntries(gameState.inventory);

  // Convert LevelNode Map (with exits) to a plain object
  const playerLevelObject: Record<string, any> = {};
  for (const [key, node] of gameState.playerLevel.entries()) {
    playerLevelObject[key] = {
      name: node.name,
      x: node.x,
      y: node.y,
      size: node.size,
      item: node.item,
      boss: node.boss,
      exits: Object.fromEntries(node.exits), // ← 🔥 key fix
    };
  }

  const gameStateToSave: GameStateInsert = {
    userId: userId,
    currentNode: gameState.currentNode,
    inventory: inventoryObject,
    updateMessage: gameState.updateMessage,
    itemAcquiredFlag: gameState.itemAcquiredFlag,
    gameOver: gameState.gameOver ? new Date() : null,
    playerLevelData: playerLevelObject,
    gamePhase: gameState.gamePhase,
    levelId: gameState.level_num,
    complete_msg: gameState.complete_msg,
    storyline: gameState.storyline,
  };

  // Save or update in DB
  await tryCatch(
    db
      .insert(gameStates)
      .values(gameStateToSave)
      .onConflictDoUpdate({
        target: gameStates.userId,
        set: {
          currentNode: gameStateToSave.currentNode,
          inventory: gameStateToSave.inventory,
          updateMessage: gameStateToSave.updateMessage,
          itemAcquiredFlag: gameStateToSave.itemAcquiredFlag,
          gameOver: gameStateToSave.gameOver,
          playerLevelData: gameStateToSave.playerLevelData,
          gamePhase: gameStateToSave.gamePhase,
          lastPlayedAt: new Date(),
        },
      }),
  );

  // if (saveResult.error) {
  //   console.error("Failed to save game state:", saveResult.error);
  // } else {
  //   console.log(`Game state for user ${userId} saved successfully.`);
  // }
}

/**
 * Creates and initializes a new GameState object for a player.
 * @param {string} levelName - The name of the level to load.
 * @returns {Promise<Result<GameState, GameStateError>>} A Result type containing a new GameState instance or an error.
 */
export async function createNewGameState(
  levelName: string,
): Promise<Result<GameState, GameStateError>> {
  let initialLevelData: {
    level_number: number;
    name: string;
    storyline: string;
    mapData: string;
    complete_msg: string;
  };
  let playerLevel: Level;
  let startingNode: string;

  const levelQueryResult = await tryCatch(
    db
      .select({
        level_number: levels.id,
        name: levels.name,
        storyline: levels.storyline,
        mapData: levels.mapData,
        complete_msg: levels.complete_msg,
      })
      .from(levels)
      .where(eq(levels.name, levelName)),
  );

  // Failure: Database query failed.
  if (levelQueryResult.error) {
    return {
      data: null,
      error: new Error("Failed to query database for level data."),
    };
  }

  if (levelQueryResult.data.length > 0) {
    // Success: Level found in DB, use it.
    const levelDataFromDb = levelQueryResult.data[0];

    if (!levelDataFromDb.mapData || !levelDataFromDb.storyline) {
      return {
        data: null,
        error: new LevelInitializationError(
          "Level data from database is corrupt: mapData or storyline is missing or null.",
        ),
      };
    }

    initialLevelData = {
      level_number: levelDataFromDb.level_number,
      name: levelDataFromDb.name,
      storyline: levelDataFromDb.storyline,
      mapData: levelDataFromDb.mapData,
      complete_msg: levelDataFromDb.complete_msg,
    };

    let parsedMap: Record<string, LevelNode>;
    try {
      // Correctly using a standard try/catch for the synchronous JSON.parse
      parsedMap = JSON.parse(initialLevelData.mapData) as Record<
        string,
        LevelNode
      >;
    } catch (error) {
      return {
        data: null,
        error: new LevelInitializationError(
          "Failed to parse map data from database.",
        ),
      };
    }

    startingNode = Object.keys(parsedMap)[0];

    playerLevel = new Map<string, LevelNode>();

    for (const [key, _node] of Object.entries(parsedMap)) {
      if (Object.prototype.hasOwnProperty.call(parsedMap, key)) {
        const parsedNode = parsedMap[key];

        const exitsMap = new Map<CanonDir, string>();
        if (parsedNode.exits) {
          for (const [exitKey, destinationId] of Object.entries(
            parsedNode.exits,
          )) {
            exitsMap.set(exitKey as CanonDir, destinationId as string);
          }
        }

        const expandedExits = buildExits(exitsMap);

        const node: LevelNode = {
          name: parsedNode.name,
          exits: expandedExits,
          item: parsedNode.item,
          boss: parsedNode.boss,
          size: parsedNode.size,
        };
        playerLevel.set(key, node);
      }
    }

    // Now that all nodes are processed, we can infer coordinates on the complete map.
    const unplacedNodes = inferNodeCoordinates(playerLevel, startingNode);

    // We do this check because we don't care about the Exit node...
    const hasOtherUnplacedNodes = Array.from(unplacedNodes).some(
      (nodeName) => nodeName !== "Exit",
    );

    if (unplacedNodes.size > 0 && hasOtherUnplacedNodes) {
      console.warn(
        `The following nodes were not connected to '${startingNode}' and had no coordinates inferred:`,
        Array.from(unplacedNodes),
      );
    } else {
      console.log(
        "All connected nodes have had their coordinates inferred successfully.",
      );
    }
  } else {
    // Failure: Level not found.
    return {
      data: null,
      error: new LevelInitializationError(
        `Level "${levelName}" not found and no default is available.`,
      ),
    };
  }

  if (!playerLevel.has(startingNode)) {
    return {
      data: null,
      error: new LevelInitializationError(
        `Starting node "${startingNode}" not found in the initial castle definition.`,
      ),
    };
  }

  // Success: Return a success object with only the data.
  return {
    data: {
      level_num: initialLevelData.level_number,
      currentNode: startingNode,
      playerLevel: playerLevel,
      inventory: new Map<string, number>(),
      updateMessage: initialLevelData.storyline,
      itemAcquiredFlag: 0,
      gameOver: false,
      gamePhase: "intro",
      complete_msg: initialLevelData.complete_msg,
      storyline: initialLevelData.storyline,
    },
    error: null,
  };
}

/**
 * Generates the introduction or help text.
 *
 * Sorry, it's ugly.
 *
 * @returns The formatted string to be displayed.
 */
// export function getIntro(): string {
//   let output = "";

//   output += "\n";
//   output += "STORYLINE\n";
//   output += `${"-".repeat(27)}\n`;
//   output +=
//     "Yugi has been banished to the Shadow Realm. Kaiba partnered with\n";
//   output +=
//     "the evil Maximillion Pegasus and was given the “Soul Prison” card\n";
//   output += "to trap Yugi during their last duel. Luckily, Yugi had on his\n";
//   output +=
//     "Millennium Puzzle necklace with him when he was trapped, so Yami\n";
//   output +=
//     "is tgamePhase: savedGameState.gamePhase,here in spirit, guiding Yugi on how to get out of the Shadow Realm.\n";
//   output += "Bad news, the necklace fell off when Yugi was banished. Yami's\n";
//   output += "instructions are simple, gather for Exodia and the necklace to\n";
//   output +=
//     "break out of the Shadow Realm. However, beware of Necross, the zombie\n";
//   output +=
//     "guardian of the Shadow Realm. Your mission is daunting, break into\n";
//   output +=
//     "the Castle of Necross’ and find the Exodia the Forbidden One (Head \n";
//   output +=
//     "of Exodia), Right Arm of The Forbidden One, Left Arm of the Forbidden\n";
//   output +=
//     "One, Right Leg of the Forbidden One, Left Leg of the Forbidden One,\n";
//   output +=
//     "and the Millennium Puzzle all while avoiding Necross! Once you have\n";
//   output +=
//     "all the cards and your necklace, find and defeat Necross to exit the\n";
//   output += "Shadow Realm!\n\n";
//   output += "Press enter to continue to instructions.";

//   return output;
// }

/**
 * Generates the game instructions and general help message.
 * The content of the final line ("Press enter to start/return")
 * dynamically changes based on the current game phase.
 *
 * TODO: Honestly, we can phase this out w/ the command dictionary.
 *
 * @param state The current GameState object
 * @returns The formatted string containing game instructions and command list.
 */
// export function getHelp(state: GameState): string {
//   let output = "";

//   output += "\n";
//   output += "INSTRUCTIONS\n";
//   output += `${"-".repeat(27)}\n`;
//   output += "To move around the castle type:\n";
//   output +=
//     "\tmove ____ or go ____ (replace ____ with cardinal direction).\n\n";
//   output += "To pick up items type:\n";
//   output +=
//     "\tget ____ (replace ____ with the full item name including spaces).\n\n";
//   output += "To show the rules type:\n";
//   output += "\thelp\n\n";
//   output += "To quit type:\n";
//   output += "\tquit or exit\n\n";
//   output += "The commands aren't case sensitive so don't worry about that!\n";
//   output +=
//     state.gamePhase === "intro" || state.gamePhase === "instruct"
//       ? "Press enter to start the game!"
//       : "Press enter to return to the game!";

//   return output;
// }

/**
 * Generates status display for the player.
 * @param state The current GameState object.
 * @returns The formatted status string.
 */
export function showStatus(state: GameState): Result<string, GameStateError> {
  let statusOutput = "";
  let directions = "";
  let itemStatus = "";

  // Get the current room node from the player's castle map
  const currentRoomNode = state.playerLevel.get(state.currentNode);

  // Not needed now, since levels are hardcoded, but will be useful in the future
  if (!currentRoomNode) {
    return {
      data: null,
      error: new InvalidGameStateError(
        `Current room "${state.currentNode}" not found in player's level map.`,
      ),
    };
  }

  const availableCanonDirs: string[] = [];
  // Iterate through the predefined canonical directions
  for (const canonDir of CANON_DIRS) {
    if (currentRoomNode.exits.has(canonDir)) {
      availableCanonDirs.push(canonDir);
    }
  }

  if (availableCanonDirs.length > 0) {
    // Format the output nicely, capitalizing for display
    const formattedDirs = availableCanonDirs
      .map((dir) => dir.charAt(0).toUpperCase() + dir.slice(1))
      .join(", ");
    directions = formattedDirs;
  } else {
    directions = "nowhere - no exits!";
  }

  let roomStatus = "";
  let inventoryMsg = "";
  let possibleMovements = "";

  if (state.currentNode === "Exit") {
    roomStatus = "You are exiting the castle.";
    inventoryMsg = "You dropped all the items in your inventory and give up!";
    possibleMovements = "";
    itemStatus = "Necross laughs at you and taunts you to try again!";
  } else {
    // This got simpler?
    if (currentRoomNode.boss) {
      roomStatus = `You are in the ${state.currentNode}. Necross is here!`;
      possibleMovements = "You can't move. It's time to duel!";
    } else {
      roomStatus = `You are in the ${state.currentNode}.`;
      possibleMovements = `You can move ${directions.toLowerCase()}.`;
    }

    let inventoryItems: string[] = [];
    state.inventory.forEach((quantity, itemName) => {
      inventoryItems.push(
        quantity > 1 ? `${itemName} (${quantity})` : itemName,
      );
    });

    inventoryMsg = `Inventory: [${inventoryItems.join(", ")}]`;

    // Clean up formatting when you get an item
    if (currentRoomNode.item) {
      const newItem = currentRoomNode.item;
      if (!state.inventory.has(newItem)) {
        if (currentRoomNode.boss) {
          itemStatus = `${newItem} is on the ground! To get it back, beat Necross!`;
        } else {
          itemStatus = `${newItem} is on the ground! To pick it up, type 'get ${newItem.toLowerCase()}'!`;
        }
      } else {
        // Player already has the item, nothing on the ground
        itemStatus = "Nothing is on the ground!";
      }
    } else {
      itemStatus =
        state.updateMessage !== ""
          ? state.updateMessage
          : "Nothing is on the ground!";

      if (state.updateMessage !== "") {
        state.updateMessage = "";
      }
    }
  }

  // Final clear for boss room
  // Including it here, since this happens at the end
  if (currentRoomNode.boss || state.currentNode === "Exit") {
    statusOutput = "\x1b[2J\x1b[H" + statusOutput;
  }

  statusOutput += `\n${"-".repeat(27)}\n`;
  statusOutput += `${roomStatus}\n`;
  statusOutput += `${inventoryMsg}\n`;
  statusOutput += `${itemStatus}\n`;
  statusOutput += `${"-".repeat(27)}\n`;
  statusOutput += `${possibleMovements}\n`;
  statusOutput += `${state.updateMessage}\n`;

  // Return success with the generated status string
  return { data: statusOutput, error: null };
}

/**
 * Updates the player's current room based on their direction input.
 * Modifies the provided GameState object in place.
 * @param state The current GameState object.
 * @param playerDirection The cardinal direction to move.
 */
export function getNewState(state: GameState, playerDirection: string): void {
  const currentRoomNode = state.playerLevel.get(state.currentNode);

  // Not important now since level is hardcoded, but will be useful
  // when we added loadable levels.
  if (!currentRoomNode) {
    state.updateMessage = "Err: Current room not found.";
    return;
  }

  // Normalize movement
  const normalizedDir = normalizeDirectionInput(playerDirection);

  let nextRoom: string | undefined;

  // Check if direction exists in current room node
  if (normalizedDir) {
    nextRoom = currentRoomNode.exits.get(normalizedDir);
  }

  if (nextRoom) {
    state.currentNode = nextRoom;
  } else {
    // Check if direction was null (no matching canonical direction)
    if (!normalizedDir) {
      state.updateMessage = `${playerDirection} didn't match any existing direction. Please use north, south, east, or west!`;
    } else {
      state.updateMessage = `You can't move ${playerDirection.toLowerCase()}, see above for the directions you can move!`;
    }
  }
}

/**
 * Handles item pickup, adding to inventory and removing from the room.
 * Modifies the provided GameState object in place.
 * @param state The current GameState object.
 * @param groundItem The name of the item to pick up (case-insensitive for input).
 */
export function pickup(state: GameState, groundItem: string): void {
  const currentRoomNode = state.playerLevel.get(state.currentNode);

  // Not important now since level is hardcoded, but will be useful
  // when we added loadable levels.
  if (!currentRoomNode) {
    state.updateMessage = "Err: Current room not found.";
    return;
  }

  // Normalize input for comparison (e.g., "right arm of the forbidden one")
  // Convert the item in the room to lowercase for case-insensitive comparison
  const itemInRoom = currentRoomNode.item;

  if (itemInRoom && groundItem.toLowerCase() === itemInRoom.toLowerCase()) {
    if (!state.inventory.has(itemInRoom)) {
      state.inventory.set(itemInRoom, 1);
      delete currentRoomNode.item;
      //state.itemAcquiredFlag = 1;
      state.updateMessage = `You have obtained ${itemInRoom}!`;
    } else {
      state.updateMessage = "You already have this.";
    }
  } else {
    state.updateMessage = `${groundItem} isn't in ${state.currentNode}! Make sure you spelled it correctly!`;
  }
}

/**
 * Checks to ensure all items are collected, if they are
 * you beat the boss.
 * @returns True if no items in node, false if there are
 *          still items in nodes
 */
function allItemsPickedUp(state: GameState): boolean {
  for (const room of state.playerLevel.values()) {
    if (room.boss) continue;
    if (room.item !== undefined && room.item !== null) {
      return false;
    }
  }

  return true;
}

function checkLevelBeat(state: GameState): Result<LevelStatus, Error> {
  // We init our levelStatus
  const levelStatus: LevelStatus = {
    boss: false,
    level_beat: false,
  };

  const currentRoomNode = state.playerLevel.get(state.currentNode);

  // Not important now since level is hardcoded, but will be useful
  // when we added loadable levels.
  if (!currentRoomNode) {
    state.updateMessage = "Err: Current room not found.";
    return {
      data: null,
      error: new InvalidGameStateError(
        "Level data from database is corrupt: mapData or storyline is missing or null.",
      ),
    };
  }

  // Check if we beat boss or die
  if (currentRoomNode.boss) {
    if (allItemsPickedUp(state)) {
      //state.updateMessage = "You beat the boss!";
      levelStatus.boss = true;
      levelStatus.level_beat = true;
      return {
        data: levelStatus,
        error: null,
      };
    } else {
      //state.updateMessage = "The boss beat you!";
      levelStatus.boss = true;
      levelStatus.level_beat = false;
      return {
        data: levelStatus,
        error: null,
      };
    }
  }

  return {
    data: levelStatus,
    error: null,
  };
}

/**
 * Checks game over conditions and updates the GameState.
 * @param state The current GameState object.
 *
 */
export async function checkGameOver(state: GameState): Promise<void> {
  // Get level status first, boss beat etc
  let levelReport;

  try {
    levelReport = checkLevelBeat(state);
    // console.log("Level Report:", levelReport);
  } catch (err) {
    console.error("checkLevelBeat threw an exception:", err);
    state.updateMessage =
      "Critical error occurred while checking level status.";
    state.gameOver = true;
    return;
  }

  if (levelReport.error) {
    // Game errored, end game and force a restart
    console.error("Game state error:", levelReport.error.message);
    state.updateMessage = `Critical error: ${levelReport.error.message}`;
    state.gameOver = true;
    return;
  }

  if (levelReport.data) {
    const levelStatus = levelReport.data;

    if (levelStatus.level_beat === true) {
      // First Scenario: We beat the level! Is there another level?
      const nextLevelId = state.level_num + 1;

      // try to pull levelId + 1
      const levelQueryResult = await tryCatch(
        db
          .select({ name: levels.name })
          .from(levels)
          .where(eq(levels.id, nextLevelId)),
      );

      // Check for a database query error first.
      if (levelQueryResult.error) {
        console.error(
          "Database query failed for next level:",
          levelQueryResult.error.message,
        );
        state.updateMessage = "An error occurred while loading the next level.";
        state.gameOver = true;
        return;
      }

      // Now, confidently check if the data exists.
      if (levelQueryResult.data.length === 0) {
        // Game Over - no additional levels!
        state.updateMessage =
          "You have completed the entire game! Congratulations!";
        state.gameOver = true;
        return;
      }

      state.updateMessage =
        state.complete_msg + "\n Press Enter to proceed to the next level!";
      state.gamePhase = "level_complete";
    } else if (levelStatus.boss === true && levelStatus.level_beat === false) {
      // Second Scenario: You fought the boss and lost - game over
      state.updateMessage = "You lost, try again!";
      state.gameOver = true;
    }
    // Do nothing - level is still ongoing
  }
}
