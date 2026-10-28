-- Date à laquelle le candidat a accepté la politique de confidentialité.
alter table public.applications add column if not exists consent_at timestamptz;
