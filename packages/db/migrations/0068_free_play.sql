CREATE TABLE "free_links" (
	"account_id" text NOT NULL,
	"linked_id" text NOT NULL,
	"score" real NOT NULL,
	"signals" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone,
	"released_at" timestamp with time zone,
	CONSTRAINT "free_links_account_id_linked_id_pk" PRIMARY KEY("account_id","linked_id")
);
--> statement-breakpoint
CREATE TABLE "free_play" (
	"user_id" text PRIMARY KEY NOT NULL,
	"email_key" text NOT NULL,
	"signup_network" text,
	"group_id" text,
	"confidence" real,
	"held_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "server_players" ADD COLUMN "confirmed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "server_players" ADD COLUMN "played_seconds" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "free_links" ADD CONSTRAINT "free_links_account_id_users_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "free_links" ADD CONSTRAINT "free_links_linked_id_users_id_fk" FOREIGN KEY ("linked_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "free_play" ADD CONSTRAINT "free_play_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "free_links_linked" ON "free_links" USING btree ("linked_id");--> statement-breakpoint
CREATE INDEX "free_play_email_key" ON "free_play" USING btree ("email_key");--> statement-breakpoint
CREATE INDEX "free_play_group" ON "free_play" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "free_play_signup_network" ON "free_play" USING btree ("signup_network");--> statement-breakpoint
CREATE INDEX "server_players_player" ON "server_players" USING btree ("player_uuid");