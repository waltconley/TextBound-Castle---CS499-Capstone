/**
 * @fileoverview Client logic/setup for the TextBound Castle Crawl.
 * Sets up Xterm.js and WebSocket communication with server.
 * @author Walter Conley
 * @date July 17, 2025
 * @version 1.0.0
 */

// public/script.ts
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";

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

  const socket = new WebSocket("ws://localhost:3001");

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

  // Event handler for incoming server messages
  socket.onmessage = (event) => {
    term.write("\x1b[2K\r"); // Clear current line + move to start
    const clean = event.data.replace(/\n/g, "\r\n"); // Normalize newlines
    term.write(clean);
    writePrompt();
    currentLine = "";
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
      socket.send(currentLine.trim() + "\n");
      // Always display new prompt on enter/reset input
      writePrompt();
      currentLine = "";
    } else if (data === "\x7f") {
      // Backspace
      if (currentLine.length > 0) {
        term.write("\b \b");
        currentLine = currentLine.slice(0, -1);
      }
    } else if (data.length === 1 && data >= " " && data <= "~") {
      // Anything else
      currentLine += data;
      term.write(data);
    }
  });
});
