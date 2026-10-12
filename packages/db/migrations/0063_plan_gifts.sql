CREATE TABLE "plan_gifts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"external_order_id" text NOT NULL,
	"buyer_id" text NOT NULL,
	"kind" text DEFAULT 'plan' NOT NULL,
	"plan_key" text,
	"months" integer,
	"code_hash" text,
	"code_hint" text,
	"emailed_at" timestamp with time zone,
	"redeemed_by" text,
	"redeemed_at" timestamp with time zone,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"voided_at" timestamp with time zone,
	"end_recorded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "plan_gifts" ADD CONSTRAINT "plan_gifts_buyer_id_users_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_gifts" ADD CONSTRAINT "plan_gifts_redeemed_by_users_id_fk" FOREIGN KEY ("redeemed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "plan_gifts_order" ON "plan_gifts" USING btree ("provider","external_order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "plan_gifts_code" ON "plan_gifts" USING btree ("code_hash");--> statement-breakpoint
CREATE INDEX "plan_gifts_buyer" ON "plan_gifts" USING btree ("buyer_id","created_at");--> statement-breakpoint
CREATE INDEX "plan_gifts_redeemed_by" ON "plan_gifts" USING btree ("redeemed_by");