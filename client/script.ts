/**
 * @fileoverview Client logic/setup for the TextBound Castle Crawl.
 * Sets up Xterm.js and WebSocket communication with server.
 * @author Walter Conley
 * @date July 17, 2025
 * @date August 1, 2025 - Added union for message types
 * @date August 3, 2025 - Updated to use WSS
 * @version 1.0.0
 */

// public/script.ts
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";

// A helper function to normalize newlines for consistent display
type ServerMessage = {
  type: "prompt" | "error" | "success" | "game_start" | "raw" | "echo-toggle";
  message: string;
};

// A class to manage the terminal's state, removing the need for a global variable.
class ConsoleSettings {
  private _isEchoing: boolean;

  constructor(isEchoing: boolean = true) {
    this._isEchoing = isEchoing;
  }

  get isEchoing(): boolean {
    return this._isEchoing;
  }

  set isEchoing(value: boolean) {
    this._isEchoing = value;
  }

  toggleEcho(value: boolean) {
    this._isEchoing = value;
  }
}

// Instantiate the console settings class
const consoleSettings = new ConsoleSettings();

// Ensures DOM is loaded before setting up
document.addEventListener("DOMContentLoaded", () => {
  const terminalContainer = document.getElementById("terminal-container");

  // Quickly exit if terminal container not found
  if (!terminalContainer) {
    console.error("Terminal container not found!");
    return;
  }

  const term = new Terminal({
    cursorBlink: true,
    fontFamily: "monospace",
    fontSize: 14,
    theme: {
      background: "#282c34",
      foreground: "#abb2bf",
      cursor: "#61afef",
      //selection: "rgba(97, 175, 239, 0.3)",
    },
  });

  // Loading FitAddon which resizes to container
  const fitAddon = new FitAddon();
  term.loadAddon(fitAddon);

  term.open(terminalContainer);
  fitAddon.fit(); // Initial fit

  // Resize listener for window resize events
  window.addEventListener("resize", () => {
    fitAddon.fit();
  });

  term.write("Connecting to server...\r\n");

  const socket = new WebSocket("wss://localhost:3000");

  let currentLine = "";
  const prompt = "\r\n / $> ";

  const writePrompt = () => {
    term.write(prompt);
  };

  // --- WebSocket Event Handlers ---

  // Connection successfully established
  socket.onopen = () => {
    term.write("Connection established.\r\n");
    writePrompt();
    term.focus();
    fitAddon.fit(); // Re-fit after initial connection messages
  };

  // A helper function to normalize newlines for consistent display
  const cleanMessage = (text: string) => text.replace(/\n/g, "\r\n");

  // Event handler for incoming server messages
  socket.onmessage = (event) => {
    const message = event.data;

    // Clear the current line to prepare for a new message
    term.write("\x1b[2K\r");

    let parsedMessage: ServerMessage;

    // Try to parse the message as JSON. If it fails, create a standard object.
    try {
      parsedMessage = JSON.parse(message);
    } catch (e) {
      // If parsing fails, it's a simple string message from the server.
      parsedMessage = { type: "raw", message };
    }

    // Entry point for all messages
    switch (parsedMessage.type) {
      case "echo-toggle":
        // This is a special case. It just toggles the echoing state and does not print anything.
        consoleSettings.toggleEcho(false);
        break;
      case "prompt":
        // For prompts, write the message without a newline so the user can type on the same line.
        term.write(`${cleanMessage(parsedMessage.message)} `);
        currentLine = "";
        break;
      case "error":
        // For errors, format and write the message, then a new prompt.
        term.writeln(`[ERROR]: ${cleanMessage(parsedMessage.message)}`);
        writePrompt();
        currentLine = "";
        break;
      case "success":
        // For successes, format and write the message, then a new prompt.
        term.writeln(`[SUCCESS]: ${cleanMessage(parsedMessage.message)}`);
        writePrompt();
        currentLine = "";
        break;
      case "game_start":
        // For game start, clean and write the message, then a new prompt.
        term.writeln(cleanMessage(parsedMessage.message));
        writePrompt();
        currentLine = "";
        break;
      case "raw":
      default:
        // This handles the initial 'auth_prompt' and any other simple messages,
        // as well as the messages that failed JSON parsing.
        term.writeln(cleanMessage(parsedMessage.message));
        writePrompt();
        currentLine = "";
        break;
    }
  };

  // Connection closed/dropped
  socket.onclose = () => {
    term.write("\r\nDisconnected from server.");
  };

  // WebSocket connection errors
  socket.onerror = (event: Event) => {
    const errorEvent = event as ErrorEvent;
    term.write(`\r\nWebSocket error: ${errorEvent.message}`);
    console.error("WebSocket Error:", errorEvent);
  };

  // --- Terminal Input Handling ---
  // Keeping this basic for now, server will probably wind up handling
  // the bulk of the input sanitization

  // This is ran every key press
  term.onData((data) => {
    //term.write(data.replace(/\r/g, "\n\r"));

    // Enter Key
    if (data === "\r") {
      consoleSettings.toggleEcho(true);
      socket.send(currentLine.trim() + "\n");
      // Always display new prompt on enter/reset input
      writePrompt();
      currentLine = "";
    } else if (data === "\x7f") {
      // Backspace
      if (currentLine.length > 0) {
        if (consoleSettings.isEchoing) {
          term.write("\b \b");
        }
        currentLine = currentLine.slice(0, -1);
      }
    } else if (data.length === 1 && data >= " " && data <= "~") {
      // Anything else
      currentLine += data;
      if (consoleSettings.isEchoing) {
        term.write(data);
      }
    }
  });
});
