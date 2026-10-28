-- Date limite, logo d'entreprise, notes internes.

alter table job_forms add column deadline date;

alter table companies add column logo_path text;

-- Logos : bucket public (un logo n'est pas secret), envoi uniquement par le serveur.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('logos', 'logos', true, 1048576, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

-- Notes internes de l'équipe sur une candidature
create table candidate_notes (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index on candidate_notes (application_id, created_at);
alter table candidate_notes enable row level security;

create policy "staff lit notes" on candidate_notes for select
  using (current_role_name() is not null and app_in_my_company(application_id));
create policy "staff écrit notes" on candidate_notes for insert
  with check (current_role_name() is not null and author_id = auth.uid() and app_in_my_company(application_id));
create policy "auteur supprime sa note" on candidate_notes for delete
  using (author_id = auth.uid() and app_in_my_company(application_id));
