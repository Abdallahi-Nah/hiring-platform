-- Entretien vidéo par IA : l'IA écrit les questions, le candidat répond en vidéo (lien privé),
-- puis l'IA transcrit les réponses et les évalue. Les RH décident toujours.

-- 1) Entretien : une ligne par candidature (jeton secret dans le lien envoyé au candidat)
create table ai_interviews (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null unique references applications(id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  status text not null default 'draft' check (status in ('draft', 'invited', 'in_progress', 'completed')),
  questions jsonb not null default '[]' check (jsonb_typeof(questions) = 'array' and jsonb_array_length(questions) <= 8),
  locale text not null default 'en' check (locale in ('en', 'fr', 'ar')),
  invited_at timestamptz,
  expires_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  eval_status ai_status,
  score numeric check (score between 0 and 100),
  evaluation jsonb,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table ai_interviews enable row level security;
create policy "staff lit entretiens IA" on ai_interviews for select
  using (current_role_name() is not null and app_in_my_company(application_id));

-- 2) Réponses vidéo (une par question, une seule tentative)
create table ai_interview_answers (
  id uuid primary key default gen_random_uuid(),
  interview_id uuid not null references ai_interviews(id) on delete cascade,
  question_index int not null check (question_index between 0 and 7),
  video_path text not null,
  duration_seconds int check (duration_seconds between 0 and 600),
  transcript text,
  transcript_status ai_status not null default 'pending',
  score numeric check (score between 0 and 100),
  evaluation jsonb,
  created_at timestamptz not null default now(),
  unique (interview_id, question_index)
);
alter table ai_interview_answers enable row level security;
create policy "staff lit réponses entretien IA" on ai_interview_answers for select
  using (
    current_role_name() is not null
    and exists (select 1 from ai_interviews i where i.id = interview_id and app_in_my_company(i.application_id))
  );

-- 3) Vidéos : bucket privé (envoi par le serveur seulement, lecture par liens temporaires)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ai-interviews', 'ai-interviews', false, 26214400, array['video/webm', 'video/mp4', 'video/quicktime'])
on conflict (id) do nothing;

-- 4) La cloche prévient l'équipe quand un entretien vidéo est terminé
alter table notifications drop constraint if exists notifications_kind_check;
alter table notifications add constraint notifications_kind_check check (kind in ('application', 'message', 'interview'));
