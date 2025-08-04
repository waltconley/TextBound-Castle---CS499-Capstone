/**
 * @fileoverview Custom error classes for handling PostgreSQL errors in a type-safe way.
 * These errors abstract the raw PostgresError from the 'pg' driver into more
 * descriptive and logical types, improving error handling across the application.
 *
 * I just made what I needed, sourced codes from:
 * https://www.postgresql.org/docs/current/errcodes-appendix.html
 */

// A custom base class for all database-related errors.
export class DatabaseError extends Error {
  constructor(
    message: string,
    public readonly name: string = "DatabaseError",
  ) {
    super(message);
    Object.setPrototypeOf(this, DatabaseError.prototype);
  }
}

/**
 * Represents an Integrity Constraint Violation (Class 23).
 * This includes unique violations, foreign key violations, and not-null violations.
 * This is particularly useful for handling duplicate user registrations.
 */
export class PostgresIntegrityConstraintViolationError extends DatabaseError {
  constructor(
    message: string,
    public readonly code: string,
    public readonly name: string = "PostgresIntegrityConstraintViolationError",
  ) {
    super(message);
    Object.setPrototypeOf(
      this,
      PostgresIntegrityConstraintViolationError.prototype,
    );
  }
}

/**
 * Represents a Connection Exception (Class 08).
 * This indicates that the application failed to connect to the database.
 */
export class PostgresConnectionError extends DatabaseError {
  constructor(
    message: string,
    public readonly code: string,
    public readonly name: string = "PostgresConnectionError",
  ) {
    super(message);
    Object.setPrototypeOf(this, PostgresConnectionError.prototype);
  }
}

/**
 * A general catch-all for any other PostgreSQL errors that are not specifically handled.
 * This allows us to still log and handle unexpected database issues gracefully.
 */
export class PostgresQueryError extends DatabaseError {
  constructor(
    message: string,
    public readonly code: string,
    public readonly name: string = "PostgresQueryError",
  ) {
    super(message);
    Object.setPrototypeOf(this, PostgresQueryError.prototype);
  }
}

// A custom error for when a user is not found during a login or lookup.
// This allows us to handle this specific case gracefully without exposing
// internal server errors to the client.
export class UserNotFoundError extends Error {
  // We need to explicitly set the prototype to ensure 'instanceof' works correctly
  // when extending built-in classes in some JavaScript environments.
  constructor(message: string) {
    super(message);
    this.name = "UserNotFoundError";
    Object.setPrototypeOf(this, UserNotFoundError.prototype);
  }
}

/**
 * Maps a raw PostgresError from the 'pg' driver to our custom error classes.
 * This function should be used within a try/catch block to abstract the low-level error.
 * @param err The error object thrown by the 'pg' driver.
 * @returns An instance of one of our custom error classes.
 */
export function createErrorFromPostgresError(err: any): DatabaseError {
  const code = err?.code;
  const message = err?.message || "Unknown database error";

  if (typeof code === "string") {
    if (code.startsWith("23")) {
      return new PostgresIntegrityConstraintViolationError(message, code);
    }
    if (code.startsWith("08")) {
      return new PostgresConnectionError(message, code);
    }
  } else if (typeof message === "string") {
    // Fallback check on error message text
    if (
      message.toLowerCase().includes("duplicate key") ||
      message.toLowerCase().includes("unique constraint")
    ) {
      // Use standard unique violation code 23505 as placeholder
      return new PostgresIntegrityConstraintViolationError(message, "23505");
    }
  }

  return new PostgresQueryError(message, code ?? "unknown");
}
