ALTER TABLE "action_priorities" DROP CONSTRAINT "action_priorities_position_unsigned_check";--> statement-breakpoint
ALTER TABLE "jobs" DROP CONSTRAINT "jobs_attempts_unsigned_check";--> statement-breakpoint
ALTER TABLE "jobs" DROP CONSTRAINT "jobs_reserved_at_unsigned_check";--> statement-breakpoint
ALTER TABLE "jobs" DROP CONSTRAINT "jobs_available_at_unsigned_check";--> statement-breakpoint
ALTER TABLE "jobs" DROP CONSTRAINT "jobs_created_at_unsigned_check";--> statement-breakpoint
ALTER TABLE "kpi_studio_options" DROP CONSTRAINT "kpi_studio_options_position_unsigned_check";--> statement-breakpoint
ALTER TABLE "otp_challenges" DROP CONSTRAINT "otp_challenges_attempts_unsigned_check";--> statement-breakpoint
ALTER TABLE "sms_ippanel_send_counters" DROP CONSTRAINT "sms_ippanel_send_counters_sent_count_unsigned_check";--> statement-breakpoint
ALTER TABLE "action_priorities" ALTER COLUMN "position" SET DATA TYPE numeric(10, 0);--> statement-breakpoint
ALTER TABLE "kpi_studio_options" ALTER COLUMN "position" SET DATA TYPE numeric(10, 0);--> statement-breakpoint
ALTER TABLE "sms_ippanel_send_counters" ALTER COLUMN "sent_count" SET DATA TYPE numeric(10, 0);--> statement-breakpoint
ALTER TABLE "action_priorities" ADD CONSTRAINT "action_priorities_position_unsigned_check" CHECK ("action_priorities"."position" >= 0 AND "action_priorities"."position" <= 4294967295);--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_attempts_unsigned_check" CHECK ("jobs"."attempts" >= 0 AND "jobs"."attempts" <= 255);--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_reserved_at_unsigned_check" CHECK ("jobs"."reserved_at" >= 0 AND "jobs"."reserved_at" <= 4294967295);--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_available_at_unsigned_check" CHECK ("jobs"."available_at" >= 0 AND "jobs"."available_at" <= 4294967295);--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_created_at_unsigned_check" CHECK ("jobs"."created_at" >= 0 AND "jobs"."created_at" <= 4294967295);--> statement-breakpoint
ALTER TABLE "kpi_studio_options" ADD CONSTRAINT "kpi_studio_options_position_unsigned_check" CHECK ("kpi_studio_options"."position" >= 0 AND "kpi_studio_options"."position" <= 4294967295);--> statement-breakpoint
ALTER TABLE "otp_challenges" ADD CONSTRAINT "otp_challenges_attempts_unsigned_check" CHECK ("otp_challenges"."attempts" >= 0 AND "otp_challenges"."attempts" <= 255);--> statement-breakpoint
ALTER TABLE "sms_ippanel_send_counters" ADD CONSTRAINT "sms_ippanel_send_counters_sent_count_unsigned_check" CHECK ("sms_ippanel_send_counters"."sent_count" >= 0 AND "sms_ippanel_send_counters"."sent_count" <= 4294967295);