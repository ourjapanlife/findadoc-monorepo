-- Demo booking requests for the showcase clinic (multilingual-online-clinic), one
-- per appointment status, so the production dashboard's Requests list and Calendar
-- have something to show: requested on 23 December 10:00 JST and 2 November,
-- confirmed, declined with a note, cancelled by the patient, and completed. It also
-- paints open hours for 21-25 December.
--
-- Temporary. Every row here has an id starting with de300000-0000-4000-, and the
-- follow-up migration that removes them ships about a week after the demo.
--
-- No uploads and no cancel token, so these rows have no files and no patient
-- manage link. Times are JST.
--
-- On a fresh local database the showcase facility does not exist yet (the seed
-- adds it after migrations, then clears booking rows), so this does nothing there.

DO $$
DECLARE
    site_id uuid := (SELECT id FROM clinic_sites WHERE id = 'a303a8ac-31c9-45d8-96d1-cf6630aa11bd');
BEGIN
    IF NOT EXISTS (SELECT 1 FROM facilities WHERE id = 'c32c316a-a368-499b-abaf-c5c973cb67e5') THEN
        RETURN;
    END IF;

    DELETE FROM booking_appointments WHERE id::text LIKE 'de300000-0000-4000-%';
    DELETE FROM booking_submissions WHERE id::text LIKE 'de300000-0000-4000-%';
    DELETE FROM clinic_availability_windows WHERE id::text LIKE 'de300000-0000-4000-%';

    INSERT INTO booking_submissions (
      id, facility_id, clinic_site_id, form_definition_id, form_version, locale,
      answers, status, notify_email_sent_at, created_date, updated_date
    ) VALUES
      (
        'de300000-0000-4000-a000-000000000001',
        'c32c316a-a368-499b-abaf-c5c973cb67e5', site_id,
        'showcase-intake-v1', 1, 'en-US',
        '{"email": "emma.wilson@example.com", "phone": "080-1234-5678", "fullName": "Emma Wilson", "age": "34", "reason": "A cough that has lasted two weeks. I would like to talk it through in English before the holidays."}',
        'notified', now() - interval '2 hours', now() - interval '2 hours', now() - interval '2 hours'
      ),
      (
        'de300000-0000-4000-a000-000000000002',
        'c32c316a-a368-499b-abaf-c5c973cb67e5', site_id,
        'findadoc-intake-v1', 1, 'pt-BR',
        '{"email": "lucas.martins@example.com", "phone": "090-2345-6789", "fullName": "Lucas Martins", "reason": "Follow-up on my blood pressure medication."}',
        'notified', now() - interval '1 day', now() - interval '1 day', now() - interval '1 day'
      ),
      (
        'de300000-0000-4000-a000-000000000003',
        'c32c316a-a368-499b-abaf-c5c973cb67e5', site_id,
        'showcase-intake-v1', 1, 'zh-CN',
        '{"email": "mei.chen@example.com", "phone": "070-3456-7890", "fullName": "Mei Chen", "age": "28", "reason": "An itchy rash on both forearms for about a week."}',
        'notified', now() - interval '2 days', now() - interval '2 days', now() - interval '1 day'
      ),
      (
        'de300000-0000-4000-a000-000000000004',
        'c32c316a-a368-499b-abaf-c5c973cb67e5', site_id,
        'findadoc-intake-v1', 1, 'en-US',
        '{"email": "james.walker@example.com", "phone": "080-4567-8901", "fullName": "James Walker", "reason": "Travel vaccinations before a trip in January."}',
        'notified', now() - interval '3 days', now() - interval '3 days', now() - interval '2 days'
      ),
      (
        'de300000-0000-4000-a000-000000000005',
        'c32c316a-a368-499b-abaf-c5c973cb67e5', site_id,
        'showcase-intake-v1', 1, 'vi-VN',
        '{"email": "lan.nguyen@example.com", "phone": "090-5678-9012", "fullName": "Nguyen Thi Lan", "age": "41", "reason": "Headaches most afternoons."}',
        'notified', now() - interval '4 days', now() - interval '4 days', now() - interval '1 day'
      ),
      (
        'de300000-0000-4000-a000-000000000006',
        'c32c316a-a368-499b-abaf-c5c973cb67e5', site_id,
        'findadoc-intake-v1', 1, 'it-IT',
        '{"email": "sofia.rossi@example.com", "phone": "070-6789-0123", "fullName": "Sofia Rossi", "reason": "Annual check-up and a prescription refill."}',
        'notified', now() - interval '9 days', now() - interval '9 days', now() - interval '2 days'
      );

    INSERT INTO booking_appointments (
      id, facility_id, clinic_site_id, booking_submission_id, starts_at, ends_at,
      duration_minutes, status, status_changed_at, status_changed_by, cancelled_by, status_reason
    ) VALUES
      (
        'de300000-0000-4000-b000-000000000001',
        'c32c316a-a368-499b-abaf-c5c973cb67e5', site_id,
        'de300000-0000-4000-a000-000000000001',
        '2026-12-23 10:00+09', '2026-12-23 10:30+09', 30,
        'requested', NULL, NULL, NULL, NULL
      ),
      (
        'de300000-0000-4000-b000-000000000002',
        'c32c316a-a368-499b-abaf-c5c973cb67e5', site_id,
        'de300000-0000-4000-a000-000000000002',
        '2026-11-02 09:30+09', '2026-11-02 10:00+09', 30,
        'requested', NULL, NULL, NULL, NULL
      ),
      (
        'de300000-0000-4000-b000-000000000003',
        'c32c316a-a368-499b-abaf-c5c973cb67e5', site_id,
        'de300000-0000-4000-a000-000000000003',
        '2026-11-04 14:00+09', '2026-11-04 14:45+09', 45,
        'confirmed', now() - interval '1 day', 'showcase-demo', NULL, NULL
      ),
      (
        'de300000-0000-4000-b000-000000000004',
        'c32c316a-a368-499b-abaf-c5c973cb67e5', site_id,
        'de300000-0000-4000-a000-000000000004',
        '2026-11-05 11:00+09', '2026-11-05 11:15+09', 15,
        'declined', now() - interval '2 days', 'showcase-demo', NULL,
        'Travel vaccines need a 30-minute visit. Please book a longer slot.'
      ),
      (
        'de300000-0000-4000-b000-000000000005',
        'c32c316a-a368-499b-abaf-c5c973cb67e5', site_id,
        'de300000-0000-4000-a000-000000000005',
        '2026-11-06 15:00+09', '2026-11-06 16:00+09', 60,
        'cancelled', now() - interval '1 day', 'patient', 'patient',
        'Feeling better now, thank you.'
      ),
      (
        'de300000-0000-4000-b000-000000000006',
        'c32c316a-a368-499b-abaf-c5c973cb67e5', site_id,
        'de300000-0000-4000-a000-000000000006',
        '2026-10-27 10:00+09', '2026-10-27 10:30+09', 30,
        'completed', now() - interval '2 days', 'showcase-demo', NULL, NULL
      );

    -- Open hours for the week of 23 December, so the request sits inside painted time.
    INSERT INTO clinic_availability_windows (
      id, facility_id, clinic_site_id, starts_at, ends_at, created_by
    )
    SELECT
      ('de300000-0000-4000-c000-0000000000' || to_char(row_number() OVER (), 'FM00'))::uuid,
      'c32c316a-a368-499b-abaf-c5c973cb67e5', site_id,
      (day + hours.opens) AT TIME ZONE 'Asia/Tokyo',
      (day + hours.closes) AT TIME ZONE 'Asia/Tokyo',
      'showcase-demo'
    FROM generate_series(timestamp '2026-12-21', timestamp '2026-12-25', interval '1 day') AS day
    CROSS JOIN (VALUES (interval '9 hours', interval '12 hours'), (interval '13 hours', interval '17 hours'))
      AS hours (opens, closes);
END $$;
