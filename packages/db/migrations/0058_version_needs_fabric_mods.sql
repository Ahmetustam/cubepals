ALTER TABLE "catalog_version_needs" ADD COLUMN "mod_ids" text[];--> statement-breakpoint
ALTER TABLE "catalog_version_needs" ADD COLUMN "mod_depends" text[];--> statement-breakpoint
ALTER TABLE "catalog_version_needs" ADD COLUMN "carries_jars" boolean;