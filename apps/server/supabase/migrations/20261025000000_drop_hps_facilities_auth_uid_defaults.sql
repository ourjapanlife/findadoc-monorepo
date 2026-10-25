-- The hosted schema defaulted both junction ids to auth.uid(), the signed-in Supabase user.
-- The API always inserts both ids, and auth.uid() does not exist outside Supabase.
ALTER TABLE "public"."hps_facilities" ALTER COLUMN "hps_id" DROP DEFAULT;
ALTER TABLE "public"."hps_facilities" ALTER COLUMN "facilities_id" DROP DEFAULT;
