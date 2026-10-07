ALTER TABLE "migrations" DROP CONSTRAINT "migrations_id_unsigned_check";--> statement-breakpoint
ALTER TABLE "migrations" ALTER COLUMN "id" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "migrations" ALTER COLUMN "id" SET MAXVALUE 9223372036854775807;--> statement-breakpoint
ALTER TABLE "migrations" ADD CONSTRAINT "migrations_id_unsigned_check" CHECK ("migrations"."id" >= 0 AND "migrations"."id" <= 4294967295);