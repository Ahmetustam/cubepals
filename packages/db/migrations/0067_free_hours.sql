ALTER TYPE "public"."stop_reason" ADD VALUE 'free_hours';--> statement-breakpoint
ALTER TABLE "power_intervals" ADD COLUMN "plan" text;