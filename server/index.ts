/**
 * @fileoverview Server for the TextBound Castle Crawl
 * Serves the client application via HTTP, then communicates
 * with client via WebSockets.
 * @author Walter Conley
 * @date July 17, 2025
 * @date August 1, 2025 - Added authentication phase logic
 * @date August 3, 2025 - Transitioned to HTTPS and WSS
 * @version 1.0.1
 */

import expressPkg from "express";
import { WebSocket, WebSocketServer } from "ws";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import * as https from "https";
import * as http from "http"; // Still need this for IncomingMessage

// Import game logic/interfaces
import type { GameState, ConnectionState } from "./types.ts";

// Start working with our game logic
import { handleCommand as importedHandleCommand } from "./commands.ts";
import { handleAuthCommand as importedAuthCommand } from "./auth_commands.ts";

// Map of all connected guests and their states
const connectionStates = new Map<WebSocket, ConnectionState>();

// Map GameState to websocket connection
const connectedClientGameStates = new Map<WebSocket, GameState>();

// Explicitly type the signature of the 'handleCommand' function
const handleAuthCommand: typeof importedAuthCommand = importedAuthCommand;

// Reconstructing filename and dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Setup Express
const express = expressPkg;
const app = express();
const port = 3000;
//const wsPort = 3001; // Separate port for WebSocket server

// Set up some ergos to deliver the correct content
const clientPath: string = path.join(__dirname, "..", "client", "dist");
// If no prod var and client build doesn't exist, serve this instead
const devWarningHTML: string = path.join(
  __dirname,
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

const options = {
  key: fs.readFileSync(path.join(__dirname, "..", "server.key")),
  cert: fs.readFileSync(path.join(__dirname, "..", "server.crt")),
};

//const wss = new WebSocketServer({ port: wsPort });

const server = https.createServer(options, app);

const wss = new WebSocketServer({ server });

wss.on("connection", (ws: WebSocket, req: http.IncomingMessage) => {
  // Get IP
  const clientIp = req.socket.remoteAddress;

  console.log(`Client (${clientIp}) connected to WebSocket Server`);

  // Initial state upon connection
  connectionStates.set(ws, { state: "guest" });

  ws.send(
    JSON.stringify({
      type: "auth_prompt",
      message:
        "Welcome to TextBound Castle Crawl. Please type 'register' or 'login'",
    }),
  );

  // Handle commands from the client
  ws.on("message", async (message) => {
    const incomingMessage = message.toString().trim();

    const connectionState = connectionStates.get(ws);

    if (!connectionState) {
      ws.send(
        JSON.stringify({
          type: "error",
          message: "Server error: Invalid connection state.",
        }),
      );
      return;
    }

    // Check if the user is in an authentication-related state.
    // If so, delegate the command to the authentication handler.
    if (
      connectionState.state === "guest" ||
      connectionState.state === "register" ||
      connectionState.state === "login" ||
      connectionState.state === "authenticated"
    ) {
      await handleAuthCommand(
        ws,
        connectionState,
        incomingMessage,
        connectionStates,
      );
      return;
    }

    // Handle game-related commands.
    switch (connectionState.state) {
      case "game_session":
        const { gameState, user } = connectionState;
        // Use the imported handleCommand with the new name
        const result = await importedHandleCommand(
          incomingMessage,
          ws,
          gameState,
          user.id,
          user.username,
        );
        ws.send(result.output);

        if (result.shouldCloseWs) {
          ws.close();
        }
        break;

      default:
        ws.send(
          JSON.stringify({
            type: "error",
            message: "Server error: Invalid connection state.",
          }),
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

server.listen(port, () => {
  console.log(
    `Express server running and serving frontend at https://localhost:${port}`,
  );
  console.log(`WebSocket server running at wss://localhost:${port}`);
});
