ALTER TABLE "server_operations" ADD COLUMN "steps" jsonb;--> statement-breakpoint
CREATE INDEX "operations_finished" ON "server_operations" USING btree ("finished_at") WHERE "server_operations"."finished_at" is not null;--> statement-breakpoint
CREATE INDEX "operations_open" ON "server_operations" USING btree ("created_at") WHERE "server_operations"."status" in ('queued', 'running');