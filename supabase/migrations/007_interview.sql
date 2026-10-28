-- Entretiens : fichier audio/vidéo (analysé) ou simple lien
insert into storage.buckets (id, name, public) values ('interviews', 'interviews', false)
on conflict do nothing;

alter table interviews alter column media_url drop not null;
alter table interviews
  add column link_url text,
  add column analysis_status ai_status,
  add column transcript text,
  add column score numeric check (score between 0 and 100),
  add column uploaded_by uuid references profiles(id);
