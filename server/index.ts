/**
 * @fileoverview Server for the TextBound Castle Crawl
 * Serves the client application via HTTP, then communicates
 * with client via WebSockets.
 * @author Walter Conley
 * @date July 17, 2025
 * @version 1.0.0
 */

import expressPkg from "express";
import { WebSocket, WebSocketServer } from "ws";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import * as http from "http";

// Import game logic/interfaces
import type { GameState, Result, GameStateError } from "./types.ts";
import { createNewGameState, getIntro } from "./game.ts";

// Start working with our game logic
import { handleCommand as importedHandleCommand } from "./commands.ts";

// Map GameState to websocket connection
const connectedClientGameStates = new Map<WebSocket, GameState>();

// Explicitly type the signature of the 'handleCommand' function
const handleCommand: typeof importedHandleCommand = importedHandleCommand;

// Reconstructing filename and dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Setup Express
const express = expressPkg;
const app = express();
const port = 3000;
const wsPort = 3001; // Separate port for WebSocket server

// Set up some ergos to deliver the correct content
const clientPath: string = path.join(__dirname, "..", "..", "client", "dist");
// If no prod var and client build doesn't exist, serve this instead
const devWarningHTML: string = path.join(
  __dirname,
  "..",
  "..",
  "client",
  "dev-warning.html",
);

const isProd: boolean = process.env.NODE_ENV === "production";
const clientBuildExists: boolean = fs.existsSync(clientPath);

// Check if we're in prod or development and deliver accordingly
if (isProd || clientBuildExists) {
  // In production we always serve client build 'client/dist'.
  // In development, serve client build if it exists
  app.use(express.static(clientPath));
  console.log(`Serving static files from: ${clientPath}`);
} else {
  if (fs.existsSync(devWarningHTML)) {
    // Serve a custom HTML page explaining how to run Parcel dev server
    app.get("/", (_: expressPkg.Request, res: expressPkg.Response) => {
      res.sendFile(devWarningHTML);
    });
    console.warn(`
===================================================================
[DEVELOPMENT HINT]
Frontend 'client/dist' directory not found. Serving a development warning page.
Please ensure Parcel's development server is running in a separate terminal:

  parcel serve public/index.html --open --port 1234
===================================================================
`);
  } else {
    console.error(`
===================================================================
[DEVELOPMENT ERROR]
Frontend 'client/dist' directory not found, and 'dev-warning.html' not found at:
${devWarningHTML}
Please create 'client/dev-warning.html' or run 'parcel build' first.
===================================================================
`);
  }
}

const wss = new WebSocketServer({ port: wsPort });

wss.on("connection", (ws: WebSocket, req: http.IncomingMessage) => {
  // Get IP
  const clientIp = req.socket.remoteAddress;

  console.log(`Client (${clientIp}) connected to WebSocket`);

  const createGameStateResult: Result<GameState, GameStateError> =
    createNewGameState();

  if (createGameStateResult.error) {
    // If GameState creation fails, log it and inform the client.
    console.error(
      `Failed to create GameState for client ${clientIp}:`,
      createGameStateResult.error.message,
    );
    ws.send(
      `Server error: Unable to start game due to an internal issue. Please try again later.\r\n`,
    );
    ws.close(); // Close the connection as the game cannot proceed
    return; // Stop execution for this connection
  }

  // If there's no error, extract the GameState object from the Result
  const clientGameState: GameState = createGameStateResult.data;
  connectedClientGameStates.set(ws, clientGameState);

  const introText = getIntro();
  ws.send(introText);

  // Handle commands from the client
  ws.on("message", async (message) => {
    // Make this callback async
    const command = message.toString(); // Don't trim here, handle in handleCommand

    try {
      // Try to retrieve existing gameState for IP
      const gameState = connectedClientGameStates.get(ws);

      if (!gameState) {
        console.error(
          `No gameState found for client ${clientIp}. Closing connection.`,
        );
        ws.send(
          "Server error: Your game state could not be found. Please reconnect.\r\n",
        );
        ws.close();
        return;
      }

      const result = await handleCommand(command, ws, gameState); // Process user input

      ws.send(result.output);

      if (result.shouldCloseWs) {
        ws.close();
      }
    } catch (error) {
      console.error("Error handling command:", error);
      ws.send(
        `Server error: ${error instanceof Error ? error.message : "Unknown error"}\r\n`,
      );
    }
  });

  ws.on("close", () => {
    console.log(`Client (${clientIp}) disconnected from WebSocket`);
    connectedClientGameStates.delete(ws);
  });

  ws.on("error", (error) => {
    console.error(`WebSocket error from ${clientIp}:`, error);
    connectedClientGameStates.delete(ws);
  });
});

app.listen(port, () => {
  console.log(
    `Express server running and serving frontend at http://localhost:${port}`,
  );
  console.log(`WebSocket server running at ws://localhost:${wsPort}`);
});
