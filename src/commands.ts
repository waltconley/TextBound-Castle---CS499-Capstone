/**
 * @fileoverview Defines and manages the game commands for TextBound Castle Crawl.
 * This file centralizes the logic for how player inputs (commands) are processed,
 * including updating the game state and generating appropriate responses.
 *
 * It defines the `Command` interface, a dictionary of all available commands,
 * and the main `handleCommand` function which dispatches
 * player inputs to the relevant command executors based on the current game phase.
 *
 * @author Walter Conley
 * @date July 17, 2025 - Initial creation
 * @date July 18, 2025 - Updated with game phase logic and explicit output handling
 * @version 1.0.1
 */

import { WebSocket } from "ws";
import type { GameState } from "./game.ts";
import {
  getNewState,
  pickup,
  showStatus,
  getHelp,
  getIntro,
  checkGameOver,
} from "./game.ts";

/**
 * Defines the structure for a command executable by the server.
 * Each command includes a description for help messages and an asynchronous
 * execute function that processes the command.
 */
export interface Command {
  /**
   * A brief explanation of what the command does, used in help listings.
   */
  description: string;
  /**
   * Executes the command logic.
   * @param args An array of strings representing arguments passed to the command.
   * @param ws The WebSocket connection associated with the client who issued the command.
   * @param gameState The current GameState object for the client's session,
   * allowing commands to interact with and modify game progress.
   * @returns A promise resolving to an object containing the output string for the client
   * and an optional flag indicating if the WebSocket connection should be closed.
   */
  execute: (
    args: string[],
    ws: WebSocket,
    gameState: GameState,
  ) => Promise<{ output: string; shouldCloseWs?: boolean }>;
}

// Dictionary of commands
const commands: { [key: string]: Command } = {
  // --- Test Commands ---
  hello: {
    description: "Get a greeting from the server.",
    execute: async (_args: string[], _ws: WebSocket, _: GameState) => {
      return { output: "Server says: Hello there, user!\r\n" };
    },
  },
  date: {
    description: "Get the current date and time.",
    execute: async (_args: string[], _ws: WebSocket, _: GameState) => {
      const currentDate = new Date().toLocaleString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      });
      return {
        output: `Server says: Today's date and time is ${currentDate}\r\n`,
      };
    },
  },
  clear: {
    description: "Clear the terminal screen.",
    execute: async (_args: string[], _ws: WebSocket, _: GameState) => {
      return { output: "\x1b[2J\x1b[H" }; // ANSI escape codes to clear screen and move cursor home
    },
  },

  move: {
    description: "Move in a cardinal direction (east, south, west, north).",
    execute: async (args: string[], _ws: WebSocket, gameState: GameState) => {
      if (args.length > 0) {
        const direction =
          args[0].charAt(0).toUpperCase() + args[0].slice(1).toLowerCase();
        getNewState(gameState, direction);
      } else {
        gameState.updateMessage = "You need a direction! (ex. move north)";
      }

      checkGameOver(gameState); // Check after moving

      return {
        output: showStatus(gameState),
        shouldCloseWs: gameState.gameOver,
      };
    },
  },

  go: {
    description: "Another alias for move.",
    execute: async (args: string[], ws: WebSocket, gameState: GameState) => {
      return commands.move.execute(args, ws, gameState);
    },
  },

  get: {
    description: "Pick up an item (ex. get item)",
    execute: async (args: string[], _ws: WebSocket, gameState: GameState) => {
      const itemName = args.join(" ");
      if (itemName) {
        pickup(gameState, itemName);
      } else {
        gameState.updateMessage =
          "You can't pick up thin air! Include the item name!";
      }

      checkGameOver(gameState); // Check after picking up item

      return {
        output: showStatus(gameState),
        shouldCloseWs: gameState.gameOver,
      };
    },
  },

  help: {
    description: "Display this help message and game instructions.",
    execute: async (_args: string[], _ws: WebSocket, _gameState: GameState) => {
      let helpOutput = "";
      helpOutput += "\r\n--- General Commands ---\r\n";

      // Iterate over the keys (command names) in the 'commands' object
      for (const cmdName in commands) {
        if (Object.prototype.hasOwnProperty.call(commands, cmdName)) {
          const commandEntry = commands[cmdName];

          const paddedCmdName = cmdName.padEnd(10);
          helpOutput += `  ${paddedCmdName} - ${commandEntry.description}\r\n`;
        }
      }

      helpOutput += "\r\nPress enter to return to the game!";
      return { output: helpOutput };
    },
  },

  quit: {
    description: "Exit the game.",
    execute: async (_args: string[], _ws: WebSocket, gameState: GameState) => {
      gameState.currentRoom = "Exit"; // Trigger game over condition in game.ts
      checkGameOver(gameState); // This will set game.gameOver = true and update message
      return {
        output: showStatus(gameState),
        shouldCloseWs: gameState.gameOver,
      };
    },
  },

  exit: {
    description: "Exit the game.",
    execute: async (args: string[], ws: WebSocket, gameState: GameState) => {
      return commands.quit.execute(args, ws, gameState);
    },
  },
};

/**
 * This functions acts as a dispatcher for all player input.
 * Determines phase of game and then directs input accordingly.
 *
 * @param inputCommand  The raw string input received from the client
 * @param ws            The WebSocket connection associated with the client
 * @param gameState     The current GameState object associated with the client
 * @returns             A promise that resolves to an object containing:
 *                        1) output - Formatted str to displayed in client terminal
 *                        2) shouldCloseWs - bool indicating if connection should close or not.
 */
export async function handleCommand(
  inputCommand: string,
  ws: WebSocket,
  gameState: GameState,
): Promise<{ output: string; shouldCloseWs?: boolean }> {
  const trimmedInput = inputCommand.trim().toLowerCase(); // Always trim and lowercase early for commands

  let output = "";
  let shouldCloseWs = false;

  console.log(
    `Current phase: ${gameState.gamePhase}, Input: "${trimmedInput}"`,
  ); // Debugging

  switch (gameState.gamePhase) {
    case "intro":
      console.log(trimmedInput);
      if (trimmedInput === "") {
        // User pressed Enter after intro
        gameState.gamePhase = "instructions_initial"; // Transition to instructions phase
        output = getHelp(gameState);
      } else {
        output = getIntro();
      }
      break;

    case "instructions_initial": // User is viewing initial instructions
      if (trimmedInput === "") {
        // User pressed Enter to start game
        gameState.gamePhase = "playing";
        output = showStatus(gameState);
      } else {
        // Typed something other than Enter during instructions
        output = getHelp(gameState);
      }
      break;

    case "viewing_help": // User has typed 'help' and is currently viewing rules
      if (trimmedInput === "") {
        // User pressed Enter to return to game
        gameState.gamePhase = "playing"; // Transition back to playing
        output = showStatus(gameState); // Show current game status
      } else {
        // Typed something other than Enter during viewing help
        output = getHelp(gameState); // Re-display instructions
      }
      break;

    case "playing":
      // This is where regular game commands are processed
      const [commandName, ...args] = trimmedInput.split(/\s+/);

      if (trimmedInput === "") {
        output = showStatus(gameState);
        break;
      }

      // Use command dict
      const commandExecutor = commands[commandName];

      if (commandExecutor) {
        // Handle help/exit here
        if (commandName === "help") {
          gameState.gamePhase = "viewing_help";
          gameState.updateMessage = ""; // Clear updateMessage for help display
        }

        const result = await commandExecutor.execute(args, ws, gameState);
        output = result.output;
        shouldCloseWs = result.shouldCloseWs ?? false;
      } else {
        gameState.updateMessage = `Command '${commandName}' not found. Type 'help' for available commands.`;
        output = showStatus(gameState);
      }
      break;

    default:
      // This case should ideally never be hit if all phases are handled
      console.error(`Unknown game phase: ${gameState.gamePhase}`);
      output = "An unexpected error occurred. Please reconnect.\r\n";
      shouldCloseWs = true;
      break;
  }

  // Prepend the clear screen ANSI escape codes
  if (!shouldCloseWs) {
    output = "\x1b[2J\x1b[H" + output;
  }

  output = output.replace(/\n/g, "\r\n");

  return { output, shouldCloseWs };
}

export type CommandExecutionResult = {
  output: string;
  shoudlCloseWs?: boolean;
};
