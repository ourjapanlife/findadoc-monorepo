-- Weekly hours that repeat every N weeks or on the nth weekday of the month (#203).
--
-- Until now a clinic_weekly_hours row repeated every week. A doctor who works every
-- other Monday, or the first Monday of each month, had to paint each date by hand.
--
-- recurrence is one of:
--   weekly       every week (every existing row)
--   interval     every interval_weeks weeks (2 to 12), starting on anchor_date,
--                which falls on the row's weekday
--   monthly_nth  the week_of_month-th weekday of each month: 1 to 4, or -1 for last
--
-- starts_on and ends_on are optional first and last JST days, inclusive. Dates are
-- Japan days. Closures and painted windows apply on top, as before.
--
-- A CHECK passes when it reads NULL, so each required field also says IS NOT NULL.
--
-- Every column is added with a default or as nullable, so existing rows become
-- weekly with no backfill.

ALTER TABLE clinic_weekly_hours
  ADD COLUMN recurrence text NOT NULL DEFAULT 'weekly',
  ADD COLUMN interval_weeks smallint,
  ADD COLUMN anchor_date date,
  ADD COLUMN week_of_month smallint,
  ADD COLUMN starts_on date,
  ADD COLUMN ends_on date;

ALTER TABLE clinic_weekly_hours
  ADD CONSTRAINT clinic_weekly_hours_recurrence_check
    CHECK (recurrence IN ('weekly', 'interval', 'monthly_nth')),
  ADD CONSTRAINT clinic_weekly_hours_interval_check
    CHECK (
      (recurrence = 'interval'
        AND interval_weeks IS NOT NULL
        AND interval_weeks BETWEEN 2 AND 12
        AND anchor_date IS NOT NULL
        AND extract(isodow FROM anchor_date) = weekday)
      OR (recurrence <> 'interval' AND interval_weeks IS NULL AND anchor_date IS NULL)
    ),
  ADD CONSTRAINT clinic_weekly_hours_week_of_month_check
    CHECK (
      (recurrence = 'monthly_nth' AND week_of_month IS NOT NULL AND week_of_month IN (1, 2, 3, 4, -1))
      OR (recurrence <> 'monthly_nth' AND week_of_month IS NULL)
    ),
  ADD CONSTRAINT clinic_weekly_hours_dates_check
    CHECK (starts_on IS NULL OR ends_on IS NULL OR ends_on >= starts_on);
