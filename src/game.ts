/**
 * /src/game.ts (server)
 * @fileoverview Defines the core game logic and data structures for TextBound Castle Crawl.
 * This file manages the game state, room definitions, item interactions,
 * and conditions for winning or losing the game.
 *
 * @author Walter Conley
 * @date July 17, 2025 - Initial creation, converted from python
 * @date July 18, 2025 - Added game phase and refined game state management and display logic
 * @version 1.0.1
 */

// TODO: Move gameOver check to end of command dispatch, clear screen once there.

/**
 * Defines the structure of a single room within the castle.
 * Each room can have cardinal directions leading to other rooms,
 * an item present, and optionally a boss.
 */
export interface Room {
  /** Allows for dynamic keys like "East", "Item", "Boss" */
  [key: string]: string | string[] | undefined;
  East?: string;
  South?: string;
  West?: string;
  North?: string;
  Item?: string;
  Boss?: string;
}

/**
 * Defines the overall structure of the game's castle.
 * It's a collection of rooms, where each key is a room's name
 * and its value is a {@link Room} object.
 */
export interface Castle {
  [roomName: string]: Room;
}

/**
 * Defines the comprehensive state of a single player's game session.
 * This interface holds all dynamic data relevant to a player's progress
 * and the current game situation.
 */
export interface GameState {
  /** The unique identifier of the room the player is currently in. */
  currentRoom: string;
  /** A list of items the player has collected */
  inventory: string[];
  /** A message to be displayed to the player, often reflecting the result of their last action. */
  updateMessage: string;
  /** Flag to indicate if an item was just acquired, used by showStatus to display a specific message. */
  itemAcquiredFlag: number;
  /** True if game has ended (win, lose , or quit) */
  gameOver: boolean;
  /** Each player has their own mutable copy of the castle */
  playerCastle: Castle;
  /** The current phase of the game, used to properly route player input */
  gamePhase: "intro" | "instructions_initial" | "playing" | "viewing_help";
}

/**
 * Creates and initializes a new GameState object for a player.
 * @returns A new GameState instance.
 * @TODO: this will eventually pull selected data from DB
 */
export function createNewGameState(): GameState {
  // Define the initial Yugi structure.
  // Created *each time* a new GameState is made!
  const initialCastle: Castle = {
    Barbican: { East: "Kitchen", South: "Gathering Hall", West: "Outer Ward" },
    Kitchen: { West: "Barbican", Item: "Right Leg Of The Forbidden One" },
    "Gathering Hall": {
      North: "Barbican",
      East: "Keep",
      Item: "Left Arm Of The Forbidden One",
    },
    Keep: { West: "Gathering Hall", Item: "Millennium Puzzle Necklace" },
    "Outer Ward": {
      East: "Barbican",
      South: "Dungeons",
      West: "Stables",
      Item: "Right Arm Of The Forbidden One",
    },
    Dungeons: {
      North: "Outer Ward",
      South: "Catacombs",
      Item: "Head Of Exodia",
    },
    Catacombs: {
      North: "Dungeons",
      Boss: "Necross",
      Item: "Your physical body",
    },
    Stables: { East: "Outer Ward", Item: "Left Leg Of The Forbidden One" },
    Exit: {},
  };

  // Deep copy the initialCastle for this player's specific game state.
  const playerCastle: Castle = JSON.parse(JSON.stringify(initialCastle));
  // Honestly, I hate this, but it works?

  return {
    currentRoom: "Barbican",
    inventory: [],
    updateMessage:
      "Welcome to the Shadow Castle! Find your loot and beat Necross!",
    itemAcquiredFlag: 0,
    gameOver: false,
    playerCastle: playerCastle,
    gamePhase: "intro",
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
    state.gamePhase === "intro" || state.gamePhase === "instructions_initial"
      ? "Press enter to start the game!"
      : "Press enter to return to the game!";

  return output;
}

/**
 * Generates status display for the player.
 * @param state The current GameState object.
 * @returns The formatted status string.
 */
export function showStatus(state: GameState): string {
  let statusOutput = "";
  let directions = "";
  let itemStatus = "";

  // Use state.playerCastle for dynamic items and room connections
  const availRooms = Object.keys(state.playerCastle[state.currentRoom]);

  let navigableRooms = [...availRooms];
  if (navigableRooms.includes("Item")) {
    navigableRooms = navigableRooms.filter((key) => key !== "Item");
  }
  if (navigableRooms.includes("Boss")) {
    navigableRooms = navigableRooms.filter((key) => key !== "Boss");
  }

  for (let i = 0; i < navigableRooms.length; i++) {
    const direction = navigableRooms[i];
    if (navigableRooms.length > 2 && i > 0) {
      if (i === navigableRooms.length - 1) {
        directions += ", or " + direction;
      } else {
        directions += ", " + direction;
      }
    } else if (navigableRooms.length === 2 && i > 0) {
      directions += " or " + direction;
    } else {
      directions = direction;
    }
  }

  let roomStatus = "";
  let inventoryMsg = "";
  let possibleMovements = "";

  if (state.currentRoom === "Exit") {
    roomStatus = "You are exiting the castle.";
    inventoryMsg = "You dropped all the items in your inventory and give up!";
    possibleMovements = "";
    itemStatus = "Necross laughs at you and taunts you to try again!";
  } else {
    if ("Boss" in state.playerCastle[state.currentRoom]) {
      roomStatus = `You are in the ${state.currentRoom}. Necross is here!`;
      possibleMovements = "You can't move. It's time to duel!";
    } else {
      roomStatus = `You are in the ${state.currentRoom}.`;
      possibleMovements = `You can move ${directions.toLowerCase()}.`;
    }

    inventoryMsg = `Inventory: [${state.inventory.join(", ")}]`;

    if ("Item" in state.playerCastle[state.currentRoom]) {
      const newItem = state.playerCastle[state.currentRoom]["Item"] as string;
      if (!state.inventory.includes(newItem)) {
        if ("Boss" in state.playerCastle[state.currentRoom]) {
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
  if (
    "Boss" in state.playerCastle[state.currentRoom] ||
    state.currentRoom === "Exit"
  ) {
    statusOutput = "\x1b[2J\x1b[H" + statusOutput;
  }

  statusOutput += `\n${"-".repeat(27)}\n`;
  statusOutput += `${roomStatus}\n`;
  statusOutput += `${inventoryMsg}\n`;
  statusOutput += `${itemStatus}\n`;
  statusOutput += `${"-".repeat(27)}\n`;
  statusOutput += `${possibleMovements}\n`;
  statusOutput += `${state.updateMessage}\n`;

  return statusOutput;
}

/**
 * Updates the player's current room based on their direction input.
 * Modifies the provided GameState object in place.
 * @param state The current GameState object.
 * @param playerDirection The cardinal direction to move.
 */
export function getNewState(state: GameState, playerDirection: string): void {
  // Check if the direction exists in the current room's connections
  if (playerDirection in state.playerCastle[state.currentRoom]) {
    state.currentRoom = state.playerCastle[state.currentRoom][
      playerDirection
    ] as string;
  } else {
    state.updateMessage = `You can't move ${playerDirection.toLowerCase()}, see above for the directions you can move!`;
  }
}

/**
 * Handles item pickup, adding to inventory and removing from the room.
 * Modifies the provided GameState object in place.
 * @param state The current GameState object.
 * @param groundItem The name of the item to pick up (case-insensitive for input).
 */
export function pickup(state: GameState, groundItem: string): void {
  // Normalize input for comparison (e.g., "right arm of the forbidden one")
  // Convert the item in the room to lowercase for case-insensitive comparison
  const itemInRoom = state.playerCastle[state.currentRoom]["Item"] as
    | string
    | undefined;

  if (itemInRoom && groundItem.toLowerCase() === itemInRoom.toLowerCase()) {
    if (!state.inventory.includes(itemInRoom)) {
      state.inventory.push(itemInRoom);
      delete state.playerCastle[state.currentRoom]["Item"]; // Modify player-specific castle copy
      state.itemAcquiredFlag = 1;
      state.updateMessage = `You have obtained ${itemInRoom}!`;
    } else {
      state.updateMessage = "You already have this.";
    }
  } else {
    state.updateMessage = `${groundItem} isn't in ${state.currentRoom}! Make sure you spelled it correctly!`;
  }
}

/**
 * Checks game over conditions and updates the GameState.
 * @param state The current GameState object.
 */
export function checkGameOver(state: GameState): void {
  if (state.currentRoom === "Exit") {
    state.updateMessage = "Thanks for playing! Hope you enjoyed it!";
    state.gameOver = true;
  }

  if ("Boss" in state.playerCastle[state.currentRoom]) {
    if (state.inventory.length < 6) {
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
