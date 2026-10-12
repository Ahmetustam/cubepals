CREATE TABLE "plan_years" (
	"provider" text NOT NULL,
	"external_order_id" text NOT NULL,
	"user_id" text NOT NULL,
	"plan_key" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"reminded_days" integer,
	"end_recorded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plan_years_provider_external_order_id_pk" PRIMARY KEY("provider","external_order_id")
);
--> statement-breakpoint
ALTER TABLE "plan_years" ADD CONSTRAINT "plan_years_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "plan_years_user" ON "plan_years" USING btree ("user_id","ends_at");