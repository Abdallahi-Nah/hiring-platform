-- Avis des RH après un entretien : 4 notes de 1 à 5 et un commentaire. Un avis par membre de l'équipe et par candidat.
-- Visible par toute l'équipe de l'entreprise, jamais par le candidat.
create table interview_feedback (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null,
  communication int not null check (communication between 1 and 5),
  technical int not null check (technical between 1 and 5),
  motivation int not null check (motivation between 1 and 5),
  culture int not null check (culture between 1 and 5),
  comment text check (comment is null or char_length(comment) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (application_id, author_id)
);
alter table interview_feedback enable row level security;

create policy "staff lit avis" on interview_feedback for select
  using (current_role_name() is not null and app_in_my_company(application_id));
create policy "staff écrit son avis" on interview_feedback for insert
  with check (current_role_name() is not null and author_id = auth.uid() and app_in_my_company(application_id));
create policy "auteur modifie son avis" on interview_feedback for update
  using (author_id = auth.uid() and app_in_my_company(application_id))
  with check (author_id = auth.uid() and app_in_my_company(application_id));
create policy "auteur supprime son avis" on interview_feedback for delete
  using (author_id = auth.uid() and app_in_my_company(application_id));
