CREATE TABLE "game_states" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"current_node" varchar(100) NOT NULL,
	"inventory" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"update_message" text,
	"item_acquired_flag" integer DEFAULT 0 NOT NULL,
	"game_over" timestamp,
	"player_level_data" jsonb NOT NULL,
	"game_phase" varchar(50) NOT NULL,
	"last_played_at" timestamp with time zone DEFAULT now() NOT NULL,
	"level_id" integer NOT NULL,
	"complete_msg" text NOT NULL,
	"storyline" text NOT NULL,
	CONSTRAINT "game_states_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "levels" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(50) NOT NULL,
	"description" text,
	"storyline" text NOT NULL,
	"map_data" text NOT NULL,
	"complete_msg" text NOT NULL,
	CONSTRAINT "levels_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" varchar(50) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"current_level_id" integer NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "game_states" ADD CONSTRAINT "game_states_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;