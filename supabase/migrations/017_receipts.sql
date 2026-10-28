-- Accusés de réception des messages : envoyé (✓), reçu (✓✓ gris : delivered_at), lu (✓✓ vert : read_at).
alter table messages add column if not exists delivered_at timestamptz;
update messages set delivered_at = read_at where read_at is not null and delivered_at is null;
