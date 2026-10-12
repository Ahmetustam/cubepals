CREATE TYPE "public"."moderation_kind" AS ENUM('warn', 'mute', 'ban');--> statement-breakpoint
CREATE TYPE "public"."moderation_state" AS ENUM('pending', 'delivered', 'lifting', 'lifted');--> statement-breakpoint
ALTER TYPE "public"."access_list" ADD VALUE 'helper';--> statement-breakpoint
CREATE TABLE "server_moderation_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"server_id" uuid NOT NULL,
	"player_uuid" uuid NOT NULL,
	"player_name" text NOT NULL,
	"kind" "moderation_kind" NOT NULL,
	"reason" text DEFAULT '' NOT NULL,
	"minutes" integer,
	"state" "moderation_state" NOT NULL,
	"error" text,
	"requested_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"delivered_at" timestamp with time zone,
	"lifted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "server_access" ADD COLUMN "moderation_ladder" jsonb;--> statement-breakpoint
ALTER TABLE "server_moderation_actions" ADD CONSTRAINT "server_moderation_actions_server_id_minecraft_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."minecraft_servers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "server_moderation_actions_server_idx" ON "server_moderation_actions" USING btree ("server_id","created_at");