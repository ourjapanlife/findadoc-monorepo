-- A hospital's staff seats. The account is a "user". The hospital is a facility.
-- A healthcare professional link is optional: a doctor is both a seat and a
-- professional, a coordinator is only a seat.
--
-- The basic plan has three active seats. A revoked seat stays in the table so
-- the history is still there, and it does not count toward the three.
-- The audit_logs row is the record of who assigned or revoked the seat.
-- auth_subject is the login id, so a hospital owner can be recognized later.

ALTER TABLE "user"
  ADD COLUMN auth_subject text;

ALTER TABLE "user"
  ADD CONSTRAINT user_auth_subject_key UNIQUE (auth_subject);

ALTER TABLE "user"
  ADD CONSTRAINT user_auth_subject_nonempty
    CHECK (auth_subject IS NULL OR char_length(auth_subject) > 0);

CREATE TABLE facility_subscriptions (
  facility_id uuid PRIMARY KEY REFERENCES facilities (id) ON UPDATE CASCADE ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'basic',
  seat_limit integer NOT NULL DEFAULT 3,
  created_date timestamptz NOT NULL DEFAULT now(),
  updated_date timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT facility_subscriptions_basic_check
    CHECK (plan = 'basic' AND seat_limit = 3)
);

CREATE TABLE facility_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id uuid NOT NULL REFERENCES facilities (id) ON UPDATE CASCADE ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES "user" (id) ON UPDATE CASCADE ON DELETE RESTRICT,
  hp_id uuid REFERENCES hps (id) ON UPDATE CASCADE ON DELETE SET NULL,
  role text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  created_date timestamptz NOT NULL DEFAULT now(),
  updated_date timestamptz NOT NULL DEFAULT now(),
  revoked_date timestamptz,
  CONSTRAINT facility_memberships_role_check
    CHECK (role IN ('owner', 'staff')),
  CONSTRAINT facility_memberships_status_check
    CHECK (status IN ('active', 'revoked')),
  CONSTRAINT facility_memberships_revoked_check
    CHECK (
      (status = 'active' AND revoked_date IS NULL)
      OR (status = 'revoked' AND revoked_date IS NOT NULL)
    ),
  CONSTRAINT facility_memberships_facility_user_key UNIQUE (facility_id, user_id)
);

CREATE UNIQUE INDEX facility_memberships_active_hp_key
  ON facility_memberships (facility_id, hp_id)
  WHERE hp_id IS NOT NULL AND status = 'active';

CREATE INDEX facility_memberships_user_id_idx ON facility_memberships (user_id);

-- A professional seat has to be a professional who already works at that hospital.
CREATE FUNCTION facility_membership_hp_at_facility()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.hp_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM hps_facilities
    WHERE hps_id = NEW.hp_id
      AND facilities_id = NEW.facility_id
  ) THEN
    RAISE EXCEPTION 'healthcare professional is not at this hospital';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER facility_memberships_hp_at_facility
  BEFORE INSERT OR UPDATE OF hp_id, facility_id
  ON facility_memberships
  FOR EACH ROW
  EXECUTE FUNCTION facility_membership_hp_at_facility();

-- The API locks the plan row. This trigger is the same limit if a write skips the API.
CREATE FUNCTION facility_membership_seat_limit()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  allowed integer;
  used integer;
BEGIN
  IF NEW.status IS DISTINCT FROM 'active' THEN
    RETURN NEW;
  END IF;

  SELECT seat_limit INTO allowed
  FROM facility_subscriptions
  WHERE facility_id = NEW.facility_id
  FOR UPDATE;

  IF allowed IS NULL THEN
    RAISE EXCEPTION 'hospital has no plan';
  END IF;

  SELECT count(*) INTO used
  FROM facility_memberships
  WHERE facility_id = NEW.facility_id
    AND status = 'active'
    AND id IS DISTINCT FROM NEW.id;

  IF used >= allowed THEN
    RAISE EXCEPTION 'hospital seat limit reached';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER facility_memberships_seat_limit
  BEFORE INSERT OR UPDATE OF status, facility_id
  ON facility_memberships
  FOR EACH ROW
  EXECUTE FUNCTION facility_membership_seat_limit();

ALTER TYPE object_type_enum ADD VALUE IF NOT EXISTS 'User';
ALTER TYPE object_type_enum ADD VALUE IF NOT EXISTS 'FacilityMembership';

ALTER TABLE facility_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE facility_memberships ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE facility_subscriptions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE facility_memberships FROM PUBLIC, anon, authenticated;

GRANT ALL ON TABLE facility_subscriptions TO service_role;
GRANT ALL ON TABLE facility_memberships TO service_role;
