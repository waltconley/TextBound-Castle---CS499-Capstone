import {
  pgTable,
  serial,
  text,
  varchar,
  timestamp,
  integer,
  jsonb,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Users Table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: varchar("username", { length: 50 }).unique().notNull(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  // Key for levels, links to the levels table
  currentLevelId: integer("current_level_id").notNull(),
});

// Levels Table
export const levels = pgTable("levels", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 50 }).unique().notNull(),
  description: text("description"),
  storyline: text("storyline").notNull(),
  mapData: text("map_data").notNull(),
  complete_msg: text("complete_msg").notNull(),
});

// GameStates Table
// This table stores the actual GameState for each user.
// `jsonb` to store the complex Map structures.
export const gameStates = pgTable("game_states", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .unique()
    .notNull(),
  currentNode: varchar("current_node", { length: 100 }).notNull(),
  inventory: jsonb("inventory")
    .$type<Record<string, number>>()
    .notNull()
    .default({}), // Storing as JSON object {item: quantity}
  updateMessage: text("update_message"),
  itemAcquiredFlag: integer("item_acquired_flag").default(0).notNull(),
  gameOver: timestamp("game_over"), // Store timestamp when game ended, or null if ongoing
  playerLevelData: jsonb("player_level_data")
    .$type<Record<string, any>>()
    .notNull(), // Storing the player's modified 'Level' as JSON
  gamePhase: varchar("game_phase", { length: 50 }).notNull(),
  lastPlayedAt: timestamp("last_played_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  levelId: integer("level_id").notNull(),
  complete_msg: text("complete_msg").notNull(),
  storyline: text("storyline").notNull(),
});

// Relations
// Define relations for Drizzle to understand how tables are linked
export const usersRelations = relations(users, ({ one }) => ({
  level: one(levels, {
    fields: [users.currentLevelId],
    references: [levels.id],
  }),
  gameState: one(gameStates, {
    fields: [users.id],
    references: [gameStates.userId],
  }),
}));

export const levelsRelations = relations(levels, ({ many }) => ({
  users: many(users),
}));

export const gameStatesRelations = relations(gameStates, ({ one }) => ({
  user: one(users, {
    fields: [gameStates.userId],
    references: [users.id],
  }),
}));
