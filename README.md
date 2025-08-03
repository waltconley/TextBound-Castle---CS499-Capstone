# TextBound Castle Crawl

A refactored, scalable, and engaging text-based adventure game, transitioning from a monolithic CLI application to a modern client-server architecture. This project showcases robust software design, effective state management, and foundational steps towards advanced data structures and persistent storage.

## 🚀 Project Overview

`TextBound Castle Crawl` reimagines a classic text adventure with a focus on modern software engineering principles. What started as a simple, in-memory Python CLI game has been transformed into a client-server application using TypeScript, enabling multi-user support and a clear separation of concerns.

## ✨ Features (Current)

- **Client-Server Architecture:** Game logic processed entirely on the server, allowing for scalability and multi-user access.
- **Decoupled Components:** A "dumb" client emulates terminal behavior, while the server handles all game state and command processing.
- **Robust State Management:** Elimination of messy global variables in favor of explicit, per-player `GameState` objects, ensuring isolation and consistency.
- **Server-Side Input Sanitization:** Initial security measures implemented to prevent malformed client data from affecting game state.
- **Object-Oriented Design:** Transition to a stateful OOP approach for game logic and player sessions.

## 📁 Project Structure

The project is organized into distinct directories to promote modularity and clarity:

```bash
├── public/                 # Client code (the "dumb" terminal emulator)
│   ├── index.html          # Main HTML page for the client
│   ├── scripts.ts          # TypeScript code for client-side logic
│   └── dev-warning.html    # Displays warning if client isn't built when accessing from port 3000.
├── src/                    # Server-side code (game logic, state management, command handling)
│   ├── game.ts             # Core game logic (e.g., handleCommand function, game phases)
│   ├── command.ts          # GameState object definitions and management
│   └── index.ts            # Main server entry point (WebSocket server, Express)
├── .nvmrc                  # Node Version Manager config to ensure consistent Node.js version
├── package.json            # Project metadata, dependencies, and scripts
├── package-lock.json       # Records exact dependency versions for reproducible builds
├── tsconfig.json           # Base TypeScript configuration for the project
├── tsconfig.server.json    # Specific TypeScript configuration for server-side compilation
└── README.md               # This file!
```

## 🏗️ Future Enhancements

This project is continuously evolving with planned enhancements in key computer science domains:

- **Algorithms & Data Structures:** Upcoming work will convert the game map to a graph data structure, enabling more complex level designs and implementing A\* pathfinding for features like "skipping rooms." Hashmaps are also planned for efficient user data management.
- **Databases:** Integration of persistent storage to manage user accounts, game progress, and level data. Currently exploring options, with strong candidates being PostgreSQL with Joist ORM or MongoDB with Mongoose for their respective strengths.
- **Enhanced Security:** Further security measures will include explicit user authentication, authorization, and robust protection of persistent data.

## 🛠️ Technologies Used

- **TypeScript:** Primary language for server-side logic and client-side scripting.
- **Node.js / Express.js:** Backend runtime and web framework for the server.
- **WebSockets:** For real-time client-server communication.
- **Xterm.js:** Used on the client-side to emulate terminal behavior.
- **Potentially:** PostgreSQL/MongoDB, Joist ORM/Mongoose (for future database integration).

## 🚀 Getting Started

### Prerequisites

- **Node.js:** **Node.js v23+:** This project leverages the experimental native TypeScript support introduced in recent Node.js versions. Ensure you have Node.js version 23 or newer installed. You can download it from [nodejs.org](https://nodejs.org/).
- **npm** or **yarn:** A package manager (comes with Node.js).

### Installation and Running

There currently is no git for the project.

1.  ~~**Clone the repository:**~~
    ```bash
    git clone [https://github.com/waltconley/textbound-castle-crawl.git](https://github.com/waltconley/textbound-castle-crawl.git)
    cd textbound-castle-crawl
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    # or yarn install
    ```
3.  **Run the server (in development mode):**
    ```bash
    npm start
    # or yarn start
    ```
4.  **Open the client:**
    Open your web browser and navigate to `http://localhost:3000`
