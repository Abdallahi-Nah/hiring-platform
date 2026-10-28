-- Groupe 2 : comptes candidats, profil, favoris, alertes emploi, salaire des offres.
-- Un compte candidat est un utilisateur Supabase SANS ligne dans "profiles" : il n'a donc jamais accès à /admin.

-- 1) Profil du candidat (lu et écrit seulement par lui)
create table candidate_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text check (char_length(full_name) <= 80),
  phone text check (char_length(phone) <= 30),
  headline text check (char_length(headline) <= 120),
  skills text[] not null default '{}' check (cardinality(skills) <= 40),
  experience jsonb not null default '[]' check (jsonb_typeof(experience) = 'array' and jsonb_array_length(experience) <= 15),
  education jsonb not null default '[]' check (jsonb_typeof(education) = 'array' and jsonb_array_length(education) <= 10),
  links text[] not null default '{}' check (cardinality(links) <= 5),
  cv_path text,
  cv_name text check (char_length(cv_name) <= 200),
  updated_at timestamptz not null default now()
);
alter table candidate_profiles enable row level security;
create policy "candidat gère son profil" on candidate_profiles for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- CV du profil : bucket privé, envoi et lecture uniquement par le serveur.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'candidate-cv', 'candidate-cv', false, 5242880,
  array['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
on conflict (id) do nothing;

-- 2) Offres favorites
create table saved_jobs (
  user_id uuid not null references auth.users(id) on delete cascade,
  job_form_id uuid not null references job_forms(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, job_form_id)
);
alter table saved_jobs enable row level security;
create policy "candidat gère ses favoris" on saved_jobs for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 3) Alertes emploi (un email par jour quand de nouvelles offres correspondent)
create table job_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  query text check (char_length(query) <= 80),
  location text check (char_length(location) <= 80),
  employment_type text check (employment_type in ('full_time', 'part_time', 'contract', 'internship')),
  work_mode text check (work_mode in ('onsite', 'hybrid', 'remote')),
  min_salary integer check (min_salary >= 0 and min_salary <= 1000000000),
  locale text not null default 'en' check (locale in ('en', 'fr', 'ar')),
  last_sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index on job_alerts (user_id);
alter table job_alerts enable row level security;
create policy "candidat gère ses alertes" on job_alerts for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 5 alertes au maximum par candidat
create function limit_job_alerts() returns trigger
language plpgsql as $$
begin
  if (select count(*) from job_alerts where user_id = new.user_id) >= 5 then
    raise exception 'too many alerts' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger job_alerts_limit before insert on job_alerts for each row execute function limit_job_alerts();

-- 4) Salaire (facultatif) des offres : public, il aide le candidat à choisir
alter table job_forms add column if not exists salary_min integer check (salary_min >= 0 and salary_min <= 1000000000);
alter table job_forms add column if not exists salary_max integer check (salary_max >= 0 and salary_max <= 1000000000);
alter table job_forms add column if not exists salary_currency text check (salary_currency ~ '^[A-Z]{3}$');
alter table job_forms add constraint job_salary_order check (salary_min is null or salary_max is null or salary_min <= salary_max);

-- 5) Une candidature peut être liée au compte du candidat (il la retrouve dans "Mes candidatures")
alter table applications add column if not exists candidate_id uuid references auth.users(id) on delete set null;
create index on applications (candidate_id);
