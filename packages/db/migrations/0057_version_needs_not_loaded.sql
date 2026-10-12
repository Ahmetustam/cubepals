CREATE TABLE "catalog_version_needs" (
	"catalog" text NOT NULL,
	"version_id" text NOT NULL,
	"java" smallint,
	"api_project_id" text,
	"api_at_least" text,
	"read_at" timestamp with time zone NOT NULL,
	CONSTRAINT "catalog_version_needs_catalog_version_id_pk" PRIMARY KEY("catalog","version_id")
);
--> statement-breakpoint
ALTER TABLE "minecraft_servers" ADD COLUMN "not_loaded" text[] DEFAULT '{}' NOT NULL;