ALTER TYPE "public"."stop_reason" ADD VALUE 'daily';--> statement-breakpoint
ALTER TABLE "account_standing" ADD COLUMN "time_zone" text;--> statement-breakpoint
ALTER TABLE "power_intervals" ADD COLUMN "play_ends_at" timestamp with time zone;