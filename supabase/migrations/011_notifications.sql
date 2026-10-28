-- Langue du candidat (pour l'email de décision) et date d'envoi de cet email.
alter table public.applications add column if not exists locale text;
alter table public.applications add column if not exists decision_email_sent_at timestamptz;
