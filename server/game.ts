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
 * @version 1.0.3
 */

import type {
  LevelNode,
  Level,
  GameState,
  CanonDir,
  Result,
  GameStateError,
} from "./types.ts";
import { LevelInitializationError, InvalidGameStateError } from "./error.ts";
import { normalizeDirectionInput, buildExits } from "./directions.ts";
import { CANON_DIRS, inferNodeCoordinates } from "./directions.ts";

// TODO: Move gameOver check to end of command dispatch, clear screen once there.

/**
 * Creates and initializes a new GameState object for a player.
 * @returns A new GameState instance.
 * @TODO: this will eventually pull selected data from DB
 */
export function createNewGameState(): Result<GameState, GameStateError> {
  // Define the initial Yugi structure.
  const initialCastle: Level = new Map<string, LevelNode>();

  initialCastle.set("Barbican", {
    name: "Barbican",
    exits: buildExits(
      new Map<CanonDir, string>([
        ["east", "Kitchen"],
        ["south", "Gathering Hall"],
        ["west", "Outer Ward"],
      ]),
    ),
  });
  initialCastle.set("Kitchen", {
    name: "Kitchen",
    exits: buildExits(new Map<CanonDir, string>([["west", "Barbican"]])),
    item: "Right Leg Of The Forbidden One",
  });
  initialCastle.set("Gathering Hall", {
    name: "Gathering Hall",
    exits: buildExits(
      new Map<CanonDir, string>([
        ["north", "Barbican"],
        ["east", "Keep"],
      ]),
    ),
    item: "Left Arm Of The Forbidden One",
  });
  initialCastle.set("Keep", {
    name: "Keep",
    exits: buildExits(new Map<CanonDir, string>([["west", "Gathering Hall"]])),
    item: "Millennium Puzzle Necklace",
  });
  initialCastle.set("Outer Ward", {
    name: "Outer Ward",
    exits: buildExits(
      new Map<CanonDir, string>([
        ["east", "Barbican"],
        ["south", "Dungeons"],
        ["west", "Stables"],
      ]),
    ),
    item: "Right Arm Of The Forbidden One",
  });
  initialCastle.set("Dungeons", {
    name: "Dungeons",
    exits: buildExits(
      new Map<CanonDir, string>([
        ["north", "Outer Ward"],
        ["south", "Catacombs"],
      ]),
    ),
    item: "Head Of Exodia",
  });
  initialCastle.set("Catacombs", {
    name: "Catacombs",
    exits: buildExits(new Map<CanonDir, string>([["north", "Dungeons"]])),
    boss: "Necross",
    item: "Your physical body",
  });
  initialCastle.set("Stables", {
    name: "Stables",
    exits: buildExits(new Map<CanonDir, string>([["east", "Outer Ward"]])),
    item: "Left Leg Of The Forbidden One",
  });
  initialCastle.set("Exit", { name: "Exit", exits: new Map() });

  // Deep copy the initialCastle for this player's specific game state.
  const playerCastle: Level = new Map<string, LevelNode>();
  initialCastle.forEach((node, name) => {
    playerCastle.set(name, {
      ...node,
      exits: new Map(node.exits), // Deep copy the exits Map
    });
  });
  let startingNode: string = "Barbican";

  // Validate starting node
  if (!playerCastle.has(startingNode)) {
    return {
      data: null,
      error: new LevelInitializationError(
        `Starting node "${startingNode}" not found in the initial castle definition.`,
      ),
    };
  }

  // Infer and pin the coordinates
  const unplacedNodes = inferNodeCoordinates(playerCastle, startingNode);

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

  return {
    data: {
      currentNode: startingNode,
      inventory: new Map<string, number>(),
      updateMessage:
        "Welcome to the Shadow Castle! Find your loot and beat Necross!",
      itemAcquiredFlag: 0,
      gameOver: false,
      playerLevel: playerCastle,
      gamePhase: "intro",
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
export function getIntro(): string {
  let output = "";

  output += "\n";
  output += "STORYLINE\n";
  output += `${"-".repeat(27)}\n`;
  output +=
    "Yugi has been banished to the Shadow Realm. Kaiba partnered with\n";
  output +=
    "the evil Maximillion Pegasus and was given the “Soul Prison” card\n";
  output += "to trap Yugi during their last duel. Luckily, Yugi had on his\n";
  output +=
    "Millennium Puzzle necklace with him when he was trapped, so Yami\n";
  output +=
    "is there in spirit, guiding Yugi on how to get out of the Shadow Realm.\n";
  output += "Bad news, the necklace fell off when Yugi was banished. Yami's\n";
  output += "instructions are simple, gather for Exodia and the necklace to\n";
  output +=
    "break out of the Shadow Realm. However, beware of Necross, the zombie\n";
  output +=
    "guardian of the Shadow Realm. Your mission is daunting, break into\n";
  output +=
    "the Castle of Necross’ and find the Exodia the Forbidden One (Head \n";
  output +=
    "of Exodia), Right Arm of The Forbidden One, Left Arm of the Forbidden\n";
  output +=
    "One, Right Leg of the Forbidden One, Left Leg of the Forbidden One,\n";
  output +=
    "and the Millennium Puzzle all while avoiding Necross! Once you have\n";
  output +=
    "all the cards and your necklace, find and defeat Necross to exit the\n";
  output += "Shadow Realm!\n\n";
  output += "Press enter to continue to instructions.";

  return output;
}

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
export function getHelp(state: GameState): string {
  let output = "";

  output += "\n";
  output += "INSTRUCTIONS\n";
  output += `${"-".repeat(27)}\n`;
  output += "To move around the castle type:\n";
  output +=
    "\tmove ____ or go ____ (replace ____ with cardinal direction).\n\n";
  output += "To pick up items type:\n";
  output +=
    "\tget ____ (replace ____ with the full item name including spaces).\n\n";
  output += "To show the rules type:\n";
  output += "\thelp\n\n";
  output += "To quit type:\n";
  output += "\tquit or exit\n\n";
  output += "The commands aren't case sensitive so don't worry about that!\n";
  output +=
    state.gamePhase === "intro" || state.gamePhase === "instruct"
      ? "Press enter to start the game!"
      : "Press enter to return to the game!";

  return output;
}

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

    // I don't feel like changing the format, so just make a list
    // Maybe eventually JSON.stringify(Object.fromEntries(state.inventory))
    // Then fix the : 1s?
    let inventoryItems: string[] = [];
    state.inventory.forEach((quantity, itemName) => {
      inventoryItems.push(
        quantity > 1 ? `${itemName} (${quantity})` : itemName,
      );
    });

    inventoryMsg = `Inventory: [${inventoryItems.join(", ")}]`;

    if (currentRoomNode.item) {
      const newItem = currentRoomNode.item;
      if (!state.inventory.has(newItem)) {
        if (currentRoomNode.boss) {
          itemStatus = `${newItem} is on the ground! To get it back, beat Necross!`;
        } else {
          itemStatus = `${newItem} is on the ground! To pick it up, type 'get ${newItem.toLowerCase()}'!`;
        }
      }
    } else {
      if (state.itemAcquiredFlag === 1) {
        itemStatus = state.updateMessage;
        state.updateMessage = ""; // Reset updateMessage after showing
        state.itemAcquiredFlag = 0;
      } else {
        itemStatus = "Nothing is on the ground!";
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
      state.itemAcquiredFlag = 1;
      state.updateMessage = `You have obtained ${itemInRoom}!`;
    } else {
      // Potentially add stacking here rather easily now?
      // If you want to allow stacking:
      // const currentQuantity = state.inventory.get(itemInRoom) || 0;
      // state.inventory.set(itemInRoom, currentQuantity + 1);
      // delete currentRoomNode.item;
      // state.itemAcquiredFlag = 1;
      // state.updateMessage = `You obtained another ${itemInRoom}!`;
      state.updateMessage = "You already have this.";
    }
  } else {
    state.updateMessage = `${groundItem} isn't in ${state.currentNode}! Make sure you spelled it correctly!`;
  }
}

/**
 * Checks game over conditions and updates the GameState.
 * @param state The current GameState object.
 */
export function checkGameOver(state: GameState): void {
  const currentRoomNode = state.playerLevel.get(state.currentNode);

  // Not important now since level is hardcoded, but will be useful
  // when we added loadable levels.
  if (!currentRoomNode) {
    state.updateMessage = "Err: Current room not found.";
    return;
  }

  if (state.currentNode === "Exit") {
    state.updateMessage = "Thanks for playing! Hope you enjoyed it!";
    state.gameOver = true;
  }

  if (currentRoomNode.boss) {
    if (state.inventory.size < 6) {
      state.updateMessage =
        "You have been defeated by Necross! You didn't have all the Exodia " +
        "pieces and the necklace! You're stuck in the Shadow Realm!\n " +
        "Thank you for playing! Hope you enjoyed it!";
    } else {
      state.updateMessage =
        "You used your necklace and Exodia pieces to beat Necross and exit " +
        "the Shadow Realm! Make sure Kaiba and Pegasus pay for this!\n " +
        "Thank you for playing! Hope you enjoyed it!";
    }
    state.gameOver = true;
  }
}
