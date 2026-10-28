-- Types
create type user_role as enum ('super_admin', 'admin', 'reviewer');
create type application_status as enum (
  'incomplete', 'submitted', 'under_review', 'shortlisted',
  'interviewed', 'evaluated', 'final_recommendation_ready'
);
create type question_type as enum (
  'short_text', 'long_text', 'number', 'dropdown', 'multiple_choice',
  'file_upload', 'voice', 'url', 'assignment_text'
);
create type hr_decision as enum ('move_to_interview', 'hire', 'reject', 'keep_in_pipeline');
create type ai_status as enum ('pending', 'done', 'failed');

-- Users (admins seulement)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role user_role not null default 'reviewer',
  full_name text,
  created_at timestamptz not null default now()
);

create table job_forms (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  reference text,
  description text,
  is_active boolean not null default false,
  evaluation_criteria jsonb not null default '{}',
  cv_max_mb int not null default 5 check (cv_max_mb between 1 and 10),
  assignment_enabled boolean not null default false,
  assignment_required boolean not null default false,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table questions (
  id uuid primary key default gen_random_uuid(),
  job_form_id uuid not null references job_forms(id) on delete cascade,
  page_number int not null default 1,
  position int not null default 0,
  type question_type not null,
  label text not null,
  required boolean not null default false,
  is_salary boolean not null default false,
  config jsonb not null default '{}'
);

create table applications (
  id uuid primary key default gen_random_uuid(),
  job_form_id uuid not null references job_forms(id) on delete cascade,
  status application_status not null default 'incomplete',
  email text,
  phone text,
  is_duplicate boolean not null default false,
  created_at timestamptz not null default now(),
  submitted_at timestamptz
);
create index on applications (job_form_id, email);
create index on applications (job_form_id, phone);

create table answers (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications(id) on delete cascade,
  question_id uuid not null references questions(id) on delete cascade,
  value jsonb,
  audio_url text,
  raw_transcript text,
  clean_transcript text,
  unique (application_id, question_id)
);

create table resumes (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications(id) on delete cascade,
  file_url text not null,
  parsed_data jsonb,
  parse_status ai_status not null default 'pending'
);

create table external_profiles (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications(id) on delete cascade,
  type text not null check (type in ('linkedin', 'behance', 'portfolio')),
  url text not null,
  parsed_data jsonb
);

create table assignments (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications(id) on delete cascade,
  type text,
  text_fields jsonb,
  link_fields jsonb
);

create table interviews (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications(id) on delete cascade,
  media_url text not null,
  audio_analysis jsonb,
  created_at timestamptz not null default now()
);

create table ai_evaluations (
  application_id uuid primary key references applications(id) on delete cascade,
  status ai_status not null default 'pending',
  score numeric check (score between 0 and 100),
  ranking_score numeric,
  strengths jsonb,
  weaknesses jsonb,
  recommendation text,
  analysis jsonb,
  updated_at timestamptz not null default now()
);

create table hr_evaluations (
  application_id uuid primary key references applications(id) on delete cascade,
  hr_score numeric check (hr_score between 0 and 100),
  hr_decision hr_decision,
  hr_notes text,
  reason_tags text[],
  updated_by uuid references profiles(id),
  updated_at timestamptz not null default now()
);

-- Aides RLS
create function current_role_name() returns user_role
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid()
$$;

alter table profiles enable row level security;
alter table job_forms enable row level security;
alter table questions enable row level security;
alter table applications enable row level security;
alter table answers enable row level security;
alter table resumes enable row level security;
alter table external_profiles enable row level security;
alter table assignments enable row level security;
alter table interviews enable row level security;
alter table ai_evaluations enable row level security;
alter table hr_evaluations enable row level security;

-- profiles
create policy "voir son profil ou super admin" on profiles for select
  using (id = auth.uid() or current_role_name() = 'super_admin');
create policy "super admin gère profils" on profiles for all
  using (current_role_name() = 'super_admin');

-- job_forms : lecture publique des formulaires actifs, gestion Admin
create policy "public voit forms actifs" on job_forms for select
  using (is_active or current_role_name() is not null);
create policy "admin gère forms" on job_forms for all
  using (current_role_name() in ('super_admin', 'admin'));

-- questions : le salaire est caché au Reviewer
create policy "public voit questions des forms actifs" on questions for select
  using (
    exists (select 1 from job_forms f where f.id = job_form_id and f.is_active)
    or current_role_name() in ('super_admin', 'admin')
    or (current_role_name() = 'reviewer' and not is_salary)
  );
create policy "admin gère questions" on questions for all
  using (current_role_name() in ('super_admin', 'admin'));

-- applications : les candidats écrivent via le serveur (service role)
create policy "staff lit candidatures" on applications for select
  using (current_role_name() is not null);

-- answers : Reviewer ne voit pas les réponses salaire
create policy "admin lit réponses" on answers for select
  using (current_role_name() in ('super_admin', 'admin'));
create policy "reviewer lit réponses non salaire" on answers for select
  using (
    current_role_name() = 'reviewer'
    and not exists (select 1 from questions q where q.id = question_id and q.is_salary)
  );

create policy "staff lit cv" on resumes for select using (current_role_name() is not null);
create policy "staff lit profils externes" on external_profiles for select using (current_role_name() is not null);
create policy "staff lit devoirs" on assignments for select using (current_role_name() is not null);
create policy "staff lit entretiens" on interviews for select using (current_role_name() is not null);
create policy "admin gère entretiens" on interviews for insert
  with check (current_role_name() is not null);
create policy "staff lit éval IA" on ai_evaluations for select using (current_role_name() is not null);
create policy "staff lit éval RH" on hr_evaluations for select using (current_role_name() is not null);
create policy "staff écrit éval RH" on hr_evaluations for insert
  with check (current_role_name() is not null);
create policy "staff modifie éval RH" on hr_evaluations for update
  using (current_role_name() is not null);

-- Vue sans salaire pour le Reviewer (exports)
create view reviewer_answers as
  select a.* from answers a
  join questions q on q.id = a.question_id
  where not q.is_salary;

-- Stockage privé
insert into storage.buckets (id, name, public) values
  ('resumes', 'resumes', false),
  ('audio', 'audio', false)
on conflict do nothing;

create policy "staff lit fichiers" on storage.objects for select
  using (bucket_id in ('resumes', 'audio') and current_role_name() is not null);
