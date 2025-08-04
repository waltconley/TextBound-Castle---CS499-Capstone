// server/auth_commands.ts

import { WebSocket } from "ws";
import bcrypt from "bcrypt";
import { db } from "./db/index.ts";
import { users, gameStates, levels } from "./db/schema.ts";
import { eq } from "drizzle-orm";
import {
  PostgresIntegrityConstraintViolationError,
  createErrorFromPostgresError,
  UserNotFoundError,
} from "./db/error.ts";
import { tryCatch } from "./types.ts";
import type {
  ConnectionState,
  LevelNode,
  GameState,
  ExitKey,
} from "./types.ts";
import { createNewGameState } from "./game.ts";

// This function takes the current connection state and handles
// all authentication-related commands.
export async function handleAuthCommand(
  ws: WebSocket,
  connectionState: ConnectionState,
  incomingMessage: string,
  connectionStates: Map<WebSocket, ConnectionState>,
): Promise<void> {
  const parts = incomingMessage.split(" ");
  const command = parts[0].toLowerCase();

  switch (connectionState.state) {
    case "guest":
      if (command === "register") {
        connectionStates.set(ws, {
          state: "register",
          registerStep: "awaiting_username",
        });
        ws.send(
          JSON.stringify({ type: "prompt", message: "Enter a username:" }),
        );
      } else if (command === "login") {
        connectionStates.set(ws, {
          state: "login",
          loginStep: "awaiting_username",
        });
        ws.send(
          JSON.stringify({ type: "prompt", message: "Enter a username:" }),
        );
      } else {
        ws.send(
          JSON.stringify({
            type: "info",
            message: "You can only login or register as a guest!",
          }),
        );
      }
      break;

    case "register":
      switch (connectionState.registerStep) {
        case "awaiting_username":
          const username = incomingMessage;
          connectionStates.set(ws, {
            state: "register",
            registerStep: "awaiting_password",
            tempUsername: username,
          });
          ws.send(JSON.stringify({ type: "echo-toggle", message: "" })); // Turn echoing off
          ws.send(
            JSON.stringify({ type: "prompt", message: "Enter a password:" }),
          );
          break;
        case "awaiting_password":
          const password = incomingMessage;
          const { tempUsername } = connectionState;

          connectionStates.set(ws, {
            state: "register",
            registerStep: "verify_password",
            tempUsername: tempUsername,
            tempPassword: password, // Store the password to verify later
          });
          ws.send(JSON.stringify({ type: "echo-toggle", message: "" })); // Turn echoing off
          ws.send(
            JSON.stringify({ type: "prompt", message: "Verify password:" }),
          );
          break;
        case "verify_password":
          const verifiedPassword = incomingMessage;
          const { tempUsername: usernameToRegister, tempPassword } =
            connectionState;

          if (verifiedPassword !== tempPassword) {
            ws.send(
              JSON.stringify({
                type: "error",
                message:
                  "Passwords do not match. Please try again with `register`.",
              }),
            );
            connectionStates.set(ws, { state: "guest" });
            return;
          }

          if (!usernameToRegister || !tempPassword) {
            ws.send(
              JSON.stringify({
                type: "error",
                message:
                  "Server error: Missing username or password. Please try again.",
              }),
            );
            connectionStates.set(ws, { state: "guest" });
            return;
          }

          const hashResult = await tryCatch(bcrypt.hash(tempPassword, 10));
          if (hashResult.error) {
            console.error("Bcrypt hashing error:", hashResult.error);
            ws.send(
              JSON.stringify({
                type: "error",
                message: "Failed to process password.",
              }),
            );
            connectionStates.set(ws, { state: "guest" });
            return;
          }
          const passwordHash = hashResult.data;
          const insertResult = await tryCatch(
            db
              .insert(users)
              .values({
                username: usernameToRegister,
                passwordHash,
                currentLevelId: 1,
              })
              .onConflictDoNothing({ target: users.username })
              .returning({ id: users.id, username: users.username }),
          );

          if (insertResult.error) {
            const customError = createErrorFromPostgresError(
              insertResult.error,
            );
            if (
              customError instanceof PostgresIntegrityConstraintViolationError
            ) {
              ws.send(
                JSON.stringify({
                  type: "error",
                  message:
                    "Username already exists. Please try again with `register`.",
                }),
              );
            } else {
              console.error("Registration error:", customError);
              ws.send(
                JSON.stringify({
                  type: "error",
                  message: "Failed to register user.",
                }),
              );
            }
            connectionStates.set(ws, { state: "guest" });
            return;
          }

          const insertedRows = insertResult.data;

          if (!insertedRows || insertedRows.length === 0) {
            // Insert skipped due to duplicate username
            ws.send(
              JSON.stringify({
                type: "error",
                message:
                  "Username already exists. Please try again with `register`.",
              }),
            );
            connectionStates.set(ws, { state: "guest" });
            return;
          }

          // Insert successful, insertedRows[0].id is the new user ID
          const newUser = insertedRows[0];

          if (!newUser) {
            ws.send(
              JSON.stringify({
                type: "error",
                message:
                  "Server error: Failed to retrieve user after registration.",
              }),
            );
            connectionStates.set(ws, { state: "guest" });
            return;
          }

          connectionStates.set(ws, {
            state: "authenticated",
            user: { id: newUser.id, username: newUser.username },
          });
          ws.send(
            JSON.stringify({
              type: "success",
              message: `Welcome, ${newUser.username}! Your account is ready. Type 'start' to begin your adventure.`,
            }),
          );
          break;
      }
      break;

    case "login":
      switch (connectionState.loginStep) {
        case "awaiting_username":
          const username = incomingMessage;
          connectionStates.set(ws, {
            state: "login",
            loginStep: "awaiting_password",
            tempUsername: username,
          });
          ws.send(JSON.stringify({ type: "echo-toggle", message: "" })); // Turn echoing off
          ws.send(
            JSON.stringify({ type: "prompt", message: "Enter a password:" }),
          );
          break;

        case "awaiting_password":
          const password = incomingMessage;
          const { tempUsername } = connectionState;

          if (!tempUsername) {
            ws.send(
              JSON.stringify({
                type: "error",
                message: "Server error: Missing username. Please try again.",
              }),
            );
            connectionStates.set(ws, { state: "guest" });
            return;
          }

          try {
            // Look up the user by username
            const userQueryResult = await db
              .select()
              .from(users)
              .where(eq(users.username, tempUsername));
            const user = userQueryResult[0];

            // If user is not found, throw a specific custom error
            if (!user) {
              throw new UserNotFoundError("Invalid username or password.");
            }

            // Compare the provided password with the stored hash
            const passwordMatch = await bcrypt.compare(
              password,
              user.passwordHash,
            );

            // If passwords don't match, throw the custom error again
            if (!passwordMatch) {
              throw new UserNotFoundError("Invalid username or password.");
            }

            // Check for an existing game state
            const gameStateResult = await tryCatch(
              db
                .select()
                .from(gameStates)
                .where(eq(gameStates.userId, user.id)),
            );
            if (gameStateResult.error) {
              console.error(
                "Failed to retrieve game state on login:",
                gameStateResult.error,
              );
              ws.send(
                JSON.stringify({
                  type: "error",
                  message: "Server error: Failed to load game data.",
                }),
              );
              connectionStates.set(ws, { state: "guest" });
              return;
            }

            const savedGameState = gameStateResult.data?.[0];

            if (savedGameState) {
              // If a game state exists, load it with your new logic
              const parsedSavedMap = savedGameState.playerLevelData as Record<
                string,
                any
              >;
              const reconstructedLevel = new Map<string, LevelNode>();

              // Loop through the parsed object to reconstruct the Map
              for (const [key, parsedNode] of Object.entries(parsedSavedMap)) {
                // Here, we use ExitKey as you correctly pointed out.
                const exitsMap = new Map<ExitKey, string>();
                if (parsedNode.exits) {
                  for (const [exitKey, destinationId] of Object.entries(
                    parsedNode.exits,
                  )) {
                    exitsMap.set(exitKey as ExitKey, destinationId as string);
                  }
                }
                const node: LevelNode = {
                  name: parsedNode.name,
                  exits: exitsMap,
                  item: parsedNode.item,
                  boss: parsedNode.boss,
                  size: parsedNode.size,
                  x: parsedNode.x,
                  y: parsedNode.y,
                };
                reconstructedLevel.set(key, node);
              }

              const clientGameState: GameState = {
                level_num: savedGameState.levelId,
                currentNode: savedGameState.currentNode,
                playerLevel: reconstructedLevel,
                inventory: new Map(Object.entries(savedGameState.inventory)), // Reconstruct the inventory Map
                updateMessage: savedGameState.updateMessage || "",
                itemAcquiredFlag: savedGameState.itemAcquiredFlag,
                gameOver: savedGameState.gameOver !== null,
                gamePhase: savedGameState.gamePhase as GameState["gamePhase"],
                complete_msg: savedGameState.complete_msg,
                storyline: savedGameState.storyline,
              };

              connectionStates.set(ws, {
                state: "game_session",
                user: { id: user.id, username: user.username },
                gameState: clientGameState,
              });

              ws.send(
                JSON.stringify({
                  type: "success",
                  message: `Welcome back, ${user.username}! Loading your saved game. Press enter to pick up where you left off!`,
                }),
              );
            } else {
              // If no game state exists, put the user in the authenticated state
              connectionStates.set(ws, {
                state: "authenticated",
                user: { id: user.id, username: user.username },
              });
              ws.send(
                JSON.stringify({
                  type: "success",
                  message: `Welcome back, ${user.username}! Type 'start' to begin your adventure.`,
                }),
              );
            }
          } catch (error) {
            if (error instanceof UserNotFoundError) {
              ws.send(
                JSON.stringify({ type: "error", message: error.message }),
              );
            } else {
              console.error("Login error:", error);
              ws.send(
                JSON.stringify({
                  type: "error",
                  message: "An unexpected server error occurred during login.",
                }),
              );
            }
            connectionStates.set(ws, { state: "guest" });
          }
          break;
      }
      break;

    case "authenticated":
      if (command === "start") {
        // clear screen
        ws.send("\x1b[2J\x1b[H");
        // Fetch the user's current level data from the database.
        const fullUserQueryResult = await db
          .select()
          .from(users)
          .where(eq(users.id, connectionState.user.id));
        const fullUser = fullUserQueryResult[0];

        if (!fullUser) {
          ws.send(
            JSON.stringify({
              type: "error",
              message: "Server error: User data not found.",
            }),
          );
          return;
        }

        const currentLevelId = fullUser.currentLevelId;
        const levelQueryResult = await db
          .select()
          .from(levels)
          .where(eq(levels.id, currentLevelId));
        const currentLevel = levelQueryResult[0];

        if (!currentLevel) {
          ws.send(
            JSON.stringify({
              type: "error",
              message: "Server error: Could not find level data.",
            }),
          );
          return;
        }

        // Create the game state based on the fetched level data.
        const createGameStateResult = await createNewGameState(
          currentLevel.name,
        );
        if (createGameStateResult.error) {
          console.error(
            `Failed to create GameState:`,
            createGameStateResult.error.message,
          );
          ws.send(
            JSON.stringify({
              type: "error",
              message: "Server error: Unable to start game.",
            }),
          );
          return;
        }
        const clientGameState = createGameStateResult.data;

        connectionStates.set(ws, {
          state: "game_session",
          user: connectionState.user,
          gameState: clientGameState,
        });

        // Send the storyline from the database instead of a hardcoded function.
        ws.send(
          JSON.stringify({
            type: "game_start",
            message: currentLevel.storyline,
          }),
        );
      } else {
        ws.send(
          JSON.stringify({
            type: "info",
            message: "You are logged in. Type 'start' to begin your adventure.",
          }),
        );
      }
      break;
  }
}
