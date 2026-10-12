CREATE TABLE "chip_in_closed" (
	"server_id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chip_in_draws" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"server_id" uuid NOT NULL,
	"owner_id" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone NOT NULL,
	"rate" double precision NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chip_in_marks" (
	"user_id" text PRIMARY KEY NOT NULL,
	"drawn_through" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chip_ins" (
	"provider" text NOT NULL,
	"external_order_id" text NOT NULL,
	"server_id" uuid NOT NULL,
	"payer_id" text NOT NULL,
	"cents" integer NOT NULL,
	"net_cents" integer NOT NULL,
	"refunded_cents" integer DEFAULT 0 NOT NULL,
	"milli" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chip_ins_provider_external_order_id_pk" PRIMARY KEY("provider","external_order_id")
);
--> statement-breakpoint
ALTER TABLE "chip_in_closed" ADD CONSTRAINT "chip_in_closed_server_id_minecraft_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."minecraft_servers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chip_in_draws" ADD CONSTRAINT "chip_in_draws_server_id_minecraft_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."minecraft_servers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chip_in_draws" ADD CONSTRAINT "chip_in_draws_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chip_in_marks" ADD CONSTRAINT "chip_in_marks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chip_ins" ADD CONSTRAINT "chip_ins_server_id_minecraft_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."minecraft_servers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chip_ins" ADD CONSTRAINT "chip_ins_payer_id_users_id_fk" FOREIGN KEY ("payer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chip_in_draws_owner" ON "chip_in_draws" USING btree ("owner_id","ended_at");--> statement-breakpoint
CREATE INDEX "chip_in_draws_server" ON "chip_in_draws" USING btree ("server_id");--> statement-breakpoint
CREATE INDEX "chip_ins_server" ON "chip_ins" USING btree ("server_id");--> statement-breakpoint
CREATE INDEX "chip_ins_payer" ON "chip_ins" USING btree ("payer_id","created_at");