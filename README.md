# TextBound Castle Crawl

A refactored, scalable, and engaging text-based adventure game, transitioning from a monolithic CLI application to a modern client-server architecture. This project showcases robust software design, effective state management, and foundational steps towards advanced data structures and persistent storage.

## 🚀 Project Overview

`TextBound Castle Crawl` reimagines a classic text adventure with a focus on modern software engineering principles. What started as a simple, in-memory Python CLI game has been transformed into a client-server application using TypeScript, a monorepo structure, and a PostgreSQL database. The project now supports multi-user access with persistent game state, all over a secure, encrypted connection.

## ✨ Features

- **Monorepo Architecture:** The project is now structured as a monorepo with a distinct `client` and `server` directory, promoting modularity and a clean separation of concerns.
- **Persistent Data Storage:** Integration of a **PostgreSQL** relational database to manage user accounts, game progress, and level data.
- **Secure Communication:** All communication between the client and server is now encrypted using **HTTPS** and **WSS (WebSockets Secure)**.
- **Drizzle ORM:** A type-safe ORM is used to interact with the database, eliminating the need for raw SQL and preventing SQL injection vulnerabilities.
- **Client-Server Architecture:** Game logic is processed entirely on the server, allowing for scalability and multi-user access.
- **Robust State Management:** Elimination of messy global variables in favor of explicit, per-player `GameState` objects, ensuring isolation and consistency.
- **Object-Oriented Design:** Transition to a stateful OOP approach for game logic and player sessions.
- **Algorithms & Data Structures:** Level data is a graph data structure, with an inferred coordinate system. Hashmaps were implemented for efficient user data management.

## 📁 Project Structure

The project has been reorganized into a monorepo to promote modularity and clarity:

```bash
.
├── README.md
├── client/                     # The "dumb" client code
│   ├── dev-warning.html
│   ├── index.html
│   ├── package-lock.json
│   ├── package.json
│   ├── script.ts
│   └── tsconfig.json
├── package-lock.json
├── package.json
├── server/                     # The core server-side code
│   ├── .env.example            # Example file for environment variables
│   ├── auth_commands.ts        # Server logic for handling authentication
│   ├── commands.ts             # Core game logic
│   ├── db                      # Database schema, seeding, and connection
│   │   ├── error.ts
│   │   ├── fixed_levels.csv
│   │   ├── index.ts
│   │   ├── schema.ts
│   │   └── seed.ts
│   ├── directions.ts
│   ├── drizzle.config.ts       # Drizzle ORM configuration
│   ├── error.ts
│   ├── game.ts
│   ├── index.ts                # Main server entry point (HTTPS/WSS, Express)
│   ├── package-lock.json
│   ├── package.json
│   ├── pathfinding.ts
│   ├── tsconfig.json
│   └── types.ts
├── server.crt                  # Self-signed SSL certificate
└── server.key                  # Self-signed SSL private key
```

## 🛠️ Technologies Used

- **TypeScript:** Primary language for server-side logic and client-side scripting.
- **Node.js / Express.js:** Backend runtime and web framework for the server.
- **WebSockets (WSS):** For secure, real-time client-server communication.
- **PostgreSQL:** A powerful relational database for persistent storage.
- **Drizzle ORM:** A modern, type-safe ORM for database interaction.
- **Xterm.js:** Used on the client-side to emulate terminal behavior.
- **OpenSSL:** Used to generate the self-signed SSL certificate for development.

## 🚀 Getting Started

### Prerequisites

- **Node.js v23+:** This project leverages the experimental native TypeScript support introduced in recent Node.js versions. Ensure you have Node.js version 23 or newer installed.
- **PostgreSQL:** A running PostgreSQL database instance is required.

### Installation and Running

1.  **Clone the repository:**

    ```bash
    git clone [[https://github.com/waltconley/textbound-castle-crawl.git](https://github.com/waltconley/textbound-castle-crawl.git)]
    cd textbound-castle-crawl
    ```

2.  **Install all dependencies for client and server from project root:**

    ```bash
    npm run install:all
    ```

3.  **Generate a self-signed certificate:**
    This is required for the HTTPS/WSS connection. In your project's root directory, run these commands and follow the prompts (use `localhost` as the Common Name):

    ```bash
    openssl genpkey -algorithm RSA -out server.key
    openssl req -new -x509 -sha256 -key server.key -out server.crt -days 365
    ```

4.  **Configure environment variables:**
    Create a `.env` file in the **`server`** directory based on the `.env.example` file.

    ```bash
    cp server/.env.example server/.env
    ```

    Then, edit the `server/.env` file with your PostgreSQL connection string.

    ```
    DATABASE_URL="postgresql://[user]:[password]@[host]:[port]/[database]"
    ```

5.  **Install dependencies and run database migrations:**
    Still in the `server` directory, push the schema to the database, and seed some level data.

    ```bash
    cd server
    npm run db:push
    npm run db:seed
    ```

6.  **Run the server:**
    Now that all dependencies are installed and the database is configured, you can start the server from the `server` directory.

    ```bash
    npm start
    ```

7.  **Open the client:**
    Open your web browser and navigate to `https://localhost:3000`. You will see a security warning due to the self-signed certificate; please accept the risk and proceed.
