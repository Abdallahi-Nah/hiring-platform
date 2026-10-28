-- Évite d'envoyer deux fois l'email de confirmation
alter table applications add column confirmation_sent_at timestamptz;
