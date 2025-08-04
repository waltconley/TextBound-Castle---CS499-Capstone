/**
 * server/commands.ts
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
 * @date July 28, 2025 - Added path command. Moved types/interfaces to types.ts
 * @version 1.0.2
 */

import { WebSocket } from "ws";
import type {
  GameState,
  Command,
  PathSegment,
  Result,
  PotentialPathingError,
} from "./types.ts";
import { findPath } from "./pathfinding.ts";
import {
  getNewState,
  pickup,
  showStatus,
  getHelp,
  getIntro,
  checkGameOver,
} from "./game.ts";

// Dictionary of commands
const commands: { [key: string]: Command } = {
  path: {
    description: "path <destination> - Shows shortest path to a destination.",
    execute: async (args, _ws, gameState) => {
      if (args.length < 1) {
        return {
          output: "Please specify a destination! Example: path <destination>",
        };
      }

      const rawDestination = args.join(" "); // Handle multiword node names
      const destination = rawDestination
        .split(" ")
        .map(
          (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
        )
        .join(" ");

      const pathResult: Result<PathSegment[], PotentialPathingError> = findPath(
        gameState.playerLevel,
        gameState.currentNode,
        destination,
      );
      let commandOutput: string;

      if (pathResult.error) {
        let errorMessage: string;

        switch (pathResult.error.name) {
          case "StartOrEndNodeNotFoundError":
            errorMessage = `The destination "${destination}" does not exist in the castle. Please check your spelling.`;
            break;
          case "NoPathFoundError":
            errorMessage = `There is no traversable path from your current location (${gameState.currentNode}) to ${destination}.`;
            break;
          case "InternalGraphConsistencyError":
            // Logging since it indicates a data or algorithm issue.
            console.error(
              "Internal Pathfinding Error:",
              pathResult.error.message,
            );
            errorMessage =
              "An internal error prevented finding the path. Please notify the game master.";
            break;
          default:
            // Unexpected errors that might implement the Error interface
            console.error(
              "An unexpected pathfinding error occurred:",
              pathResult.error,
            );
            errorMessage = `An unknown error occurred while trying to find a path.`;
            break;
        }
        gameState.updateMessage = errorMessage;
      } else {
        const path = pathResult.data; // Now we know 'path' is PathSegment[]

        let pathOutput = `Path to ${destination}:\n`;

        // If the path involves moving (more than just the current node)
        if (path.length > 1) {
          for (let i = 1; i < path.length; i++) {
            const segment = path[i];

            if (segment.directionFromPrevious) {
              pathOutput += `  - Go ${segment.directionFromPrevious.toLowerCase()} to ${segment.nodeName}\n`;
            } else {
              // Fallback that ideally won't be hit with a correctly reconstructed path.
              // This case indicates an unexpected issue in path reconstruction,
              // or the first node being considered in loop
              pathOutput += `  - Arrive at ${segment.nodeName} (unknown direction)\n`;
            }
          }
        } else {
          // This means path.length is 1, so sNode === eNode
          pathOutput += `\nYou are already in ${destination}.`;
        }

        gameState.updateMessage = pathOutput;
      }

      const statusResult = showStatus(gameState);

      if (statusResult.error) {
        console.error(
          "CRITICAL ERROR: showStatus failed due to invalid game state: ",
          statusResult.error,
        );
        commandOutput =
          "An internal game error occurred. Please restart the game.";
      } else {
        commandOutput = statusResult.data;
      }

      return {
        output: commandOutput,
        shouldCloseWs: gameState.gameOver,
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
    description:
      "Move in a cardinal direction (move <east, south, west, or north>).",
    execute: async (args: string[], _ws: WebSocket, gameState: GameState) => {
      if (args.length > 0) {
        const direction =
          args[0].charAt(0).toUpperCase() + args[0].slice(1).toLowerCase();
        getNewState(gameState, direction);
      } else {
        gameState.updateMessage = "You need a direction! (ex. move north)";
      }

      checkGameOver(gameState); // Check after moving

      let commandOutput: string;

      const statusResult = showStatus(gameState);

      if (statusResult.error) {
        console.error(
          "CRITICAL ERROR: showStatus failed due to invalid game state: ",
          statusResult.error,
        );
        commandOutput =
          "An internal game error occurred. Please restart the game.";
      } else {
        commandOutput = statusResult.data;
      }

      return {
        output: commandOutput,
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
    description: "Pick up an item (ex. get <item>)",
    execute: async (args: string[], _ws: WebSocket, gameState: GameState) => {
      const itemName = args.join(" ");
      if (itemName) {
        pickup(gameState, itemName);
      } else {
        gameState.updateMessage =
          "You can't pick up thin air! Include the item name!";
      }

      checkGameOver(gameState); // Check after picking up item

      let commandOutput: string;

      const statusResult = showStatus(gameState);

      if (statusResult.error) {
        console.error(
          "CRITICAL ERROR: showStatus failed due to invalid game state: ",
          statusResult.error,
        );
        commandOutput =
          "An internal game error occurred. Please restart the game.";
      } else {
        commandOutput = statusResult.data;
      }

      return {
        output: commandOutput,
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
      gameState.currentNode = "Exit"; // Trigger game over condition in game.ts
      checkGameOver(gameState); // This will set game.gameOver = true and update message

      let commandOutput: string;

      const statusResult = showStatus(gameState);

      if (statusResult.error) {
        console.error(
          "CRITICAL ERROR: showStatus failed due to invalid game state: ",
          statusResult.error,
        );
        commandOutput =
          "An internal game error occurred. Please restart the game.";
      } else {
        commandOutput = statusResult.data;
      }

      return {
        output: commandOutput,
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

  // Debugging Purposes
  let begin_phase = gameState.gamePhase;

  gameState.updateMessage = "";

  switch (gameState.gamePhase) {
    case "intro":
      if (trimmedInput === "") {
        // User pressed Enter after intro
        gameState.gamePhase = "instruct"; // Transition to instructions phase
        output = getHelp(gameState);
      } else {
        output = getIntro();
      }
      break;

    case "instruct": // User is viewing initial instructions
      if (trimmedInput === "") {
        // User pressed Enter to start game
        gameState.gamePhase = "playing";
        const statusResult = showStatus(gameState);
        if (statusResult.error) {
          console.error("Error displaying initial status:", statusResult.error);
          output =
            "An internal error occurred while starting the game status. Please restart.";
          shouldCloseWs = true; // Critical error, may need to close connection
        } else {
          output = statusResult.data;
        }
      } else {
        // Typed something other than Enter during instructions
        output = getHelp(gameState);
      }
      break;

    case "help": // User has typed 'help' and is currently viewing rules
      if (trimmedInput === "") {
        // User pressed Enter to return to game
        gameState.gamePhase = "playing"; // Transition back to playing
        const statusResult = showStatus(gameState);
        if (statusResult.error) {
          console.error(
            "Error returning to game status from help:",
            statusResult.error,
          );
          output =
            "An internal error occurred while returning to game. Please restart.";
          shouldCloseWs = true; // Critical error
        } else {
          output = statusResult.data;
        }
      } else {
        // Typed something other than Enter during viewing help
        output = getHelp(gameState); // Re-display instructions
      }
      break;

    case "playing":
      // This is where regular game commands are processed
      const [commandName, ...args] = trimmedInput.split(/\s+/);

      if (trimmedInput === "") {
        const statusResult = showStatus(gameState);
        if (statusResult.error) {
          console.error(
            "Error displaying status for empty input:",
            statusResult.error,
          );
          output =
            "An internal error occurred while refreshing status. Please try again.";
        } else {
          output = statusResult.data;
        }
        break;
      }

      // Use command dict
      const commandExecutor = commands[commandName];

      if (commandExecutor) {
        // Handle help/exit here
        if (commandName === "help") {
          gameState.gamePhase = "help";
          gameState.updateMessage = ""; // Clear updateMessage for help display
        }

        const result = await commandExecutor.execute(args, ws, gameState);
        output = result.output;
        shouldCloseWs = result.shouldCloseWs ?? false;
      } else {
        gameState.updateMessage = `Command '${commandName}' not found. Type 'help' for available commands.`;
        const statusResult = showStatus(gameState);
        if (statusResult.error) {
          console.error(
            "Error displaying status after unknown command:",
            statusResult.error,
          );
          output =
            "An internal error occurred while displaying status after your command. Please try again.";
        } else {
          output = statusResult.data;
        }
      }
      break;

    default:
      // This case should ideally never be hit if all phases are handled
      console.error(`Unknown game phase: ${gameState.gamePhase}`);
      output = "An unexpected error occurred. Please reconnect.\r\n";
      shouldCloseWs = true;
      break;
  }

  // Debgging, beginning phase, input: " ", ending phase for every input
  console.log(`${begin_phase} \t "${trimmedInput}" \t ${gameState.gamePhase}`);

  // Prepend the clear screen ANSI escape codes
  if (!shouldCloseWs) {
    output = "\x1b[2J\x1b[H" + output;
  }

  output = output.replace(/\n/g, "\r\n");

  return { output, shouldCloseWs };
}
