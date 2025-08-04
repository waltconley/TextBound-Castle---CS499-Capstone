/**
 * @fileoverview This file centralizes the definition of specific error types
 * used throughout the server-side logic, particularly for domain-specific failures
 * like pathfinding operations. Using custom error classes allows for more granular
 * error handling and type-safe error discrimination at the call site.
 *
 * @author Walter Conley
 * @date July 25, 2025 - Added basic errors and grouped in types.ts w/ unions
 * @version 1.0.0
 */

export class PathfindingError extends Error {
  constructor(
    message: string,
    public readonly name: string = "PathfindingError",
  ) {
    super(message);
    Object.setPrototypeOf(this, PathfindingError.prototype);
  }
}

export class StartOrEndNodeNotFoundError extends PathfindingError {
  constructor(message: string) {
    super(message, "StartOrEndNodeNotFoundError");
    Object.setPrototypeOf(this, StartOrEndNodeNotFoundError.prototype);
  }
}

export class NoPathFoundError extends PathfindingError {
  constructor(message: string) {
    super(message, "NoPathFoundError");
    Object.setPrototypeOf(this, NoPathFoundError.prototype);
  }
}

export class InternalGraphConsistencyError extends PathfindingError {
  constructor(message: string) {
    super(message, "InternalGraphConsistencyError");
    Object.setPrototypeOf(this, InternalGraphConsistencyError.prototype);
  }
}

/**
 * Custom error class for issues encountered during the initial setup or loading of a game level.
 * This indicates a fundamental problem with the game's starting configuration.
 */
export class LevelInitializationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LevelInitializationError";
    Object.setPrototypeOf(this, LevelInitializationError.prototype);
  }
}

/**
 * Custom error class for situations where the GameState is found to be in an invalid or
 * inconsistent condition during an operation (e.g., current room does not exist).
 */
export class InvalidGameStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidGameStateError";
    Object.setPrototypeOf(this, InvalidGameStateError.prototype);
  }
}
