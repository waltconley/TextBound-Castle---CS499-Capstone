/**
 * server/types.ts
 * @fileoverview Defines all core type interfaces and type aliases for TextBound Castle Crawl.
 * This file centralizes the data structures used throughout the server-side game logic,
 * including definitions for game world entities (nodes, levels), player state,
 * command handling, and pathing.
 *
 * @author Walter Conley
 * @date July 23, 2025 - Initial creation
 * @date July 24, 2025 - Added GameState, Command, CommandExecutionResult, and PathSegment interfaces/types
 * @date July 25, 2025 - Added X and Y props to LevelNodes, so we can generate a coordinate system
 *                     - Added Result<T, E> type for explicit error handling
 *                     - Added tryCatch utility function to wrap promises into Result types
 *                     - Added Errors.ts, and union group in this file
 * @version 1.0.0
 */
import { WebSocket } from "ws";
import * as Errors from "./error.ts";

/**
 * Represents the successful outcome of an operation.
 * Contains the successful data and explicitly indicates no error.
 * @template T The type of the successful data.
 * @credit Theo (https://gist.github.com/t3dotgg/a486c4ae66d32bf17c09c73609dacc5b
 */
export type Success<T> = {
  data: T;
  error: null;
};

/**
 * Represents the failed outcome of an operation.
 * Contains null data and the specific error that occurred.
 * @template E The type of the error.
 * @credit Theo (https://gist.github.com/t3dotgg/a486c4ae66d32bf17c09c73609dacc5b)
 */
export type Failure<E> = {
  data: null;
  error: E;
};

/**
 * A discriminated union type representing the explicit outcome of an operation.
 * It can either be a {@link Success} containing data or a {@link Failure} containing an error.
 * This pattern enforces explicit error handling at the type level.
 * @template T The type of the data returned on success.
 * @template E The type of the error returned on failure. Defaults to a generic `Error` object.
 * @credit Theo (https://gist.github.com/t3dotgg/a486c4ae66d32bf17c09c73609dacc5b)
 */
export type Result<T, E = Error> = Success<T> | Failure<E>;

/**
 * Asynchronously executes a Promise and wraps its outcome (success or error)
 * into a Result object for explicit, type-safe error handling.
 * @credit Theo (https://gist.github.com/t3dotgg/a486c4ae66d32bf17c09c73609dacc5b)
 *
 * @param promise The Promise to execute.
 * @returns A Promise that resolves to a Result object,
 * containing the data on success or the caught error on failure.
 *
 * Not useful yet, but will be useful when we add async I/O!
 */
export async function tryCatch<T, E = Error>(
  promise: Promise<T>,
): Promise<Result<T, E>> {
  try {
    const data = await promise;
    return { data, error: null };
  } catch (error) {
    return { data: null, error: error as E };
  }
}

/**
 * A union type representing all possible specific errors that can be
 * returned by pathfinding operations within the game. This centralizes
 * pathfinding-related error handling.
 */
export type PotentialPathingError =
  | Errors.PathfindingError
  | Errors.StartOrEndNodeNotFoundError
  | Errors.NoPathFoundError
  | Errors.InternalGraphConsistencyError;

export type GameStateError =
  | Errors.LevelInitializationError
  | Errors.InvalidGameStateError;

/**
 * Defines the canonical (primary, normalized) cardinal directions.
 * These are the standard names used internally for game logic.
 * Always in lowercase.
 */
export type CanonDir = "north" | "south" | "east" | "west";

/**
 * Defines all possible string keys that can be used in the `exits` Map,
 * including canonical directions and their lowercase synonyms.
 */
export type ExitKey =
  | CanonDir
  | "n"
  | "s"
  | "e"
  | "w"
  | "u"
  | "d"
  | "l"
  | "r"
  | "up"
  | "down"
  | "right"
  | "left";

/**
 * Defines a Node (Room) within the level.
 */
export interface LevelNode {
  name: string;
  // Exits are edges to other nodes
  exits: Map<ExitKey, string>;
  item?: string;
  boss?: string;
  // Used for A* - x and y are computed during level init, size represents room size
  size?: number;
  x?: number;
  y?: number;
}

/**
 * Represents the entire castle structure, mapping room names to Node objects.
 */
export type Level = Map<string, LevelNode>;

/**
 * Defines the comprehensive state of a single player's game session.
 * This interface holds all dynamic data relevant to a player's progress
 * and the current game situation.
 */
export interface GameState {
  // The unique identifier of the room the player is currently in.
  currentNode: string;
  // A map of items the player has collected, where key is item name and value is quantity.
  inventory: Map<string, number>;
  // A message to be displayed to the player, often reflecting the result of their last action.
  itemAcquiredFlag: number;
  // True if game has ended (win, lose , or quit)
  gameOver: boolean;
  // Each player has their own mutable copy of the level
  playerLevel: Level;
  // The current phase of the game, used to properly route player input
  gamePhase: "intro" | "instruct" | "playing" | "help";
  // A message to be displayed to the player, often reflecting the result of their last action.
  updateMessage: string;
}

/**
 * Result of executing a command.
 */
export type CommandExecutionResult = {
  output: string;
  shouldCloseWs?: boolean;
};

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
  ) => Promise<CommandExecutionResult>; // Use the type here
}

/**
 * Represents a segment of a path
 * Indicates the room and the direction taken to reach it.
 */
export interface PathSegment {
  /** The name of the node in this path segment. */
  nodeName: string;
  /** The canonical direction taken to arrive at this room from the previous one.
   * Will be null for the starting room of the path.
   */
  directionFromPrevious?: string | null;
}
