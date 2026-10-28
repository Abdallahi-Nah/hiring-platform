-- Groupe 1 : page entreprise, modèles d'emails, suivi de candidature, messagerie, notifications, vues.

-- 1) Page entreprise publique
alter table companies add column if not exists description text check (char_length(description) <= 1500);
alter table companies add column if not exists website text check (char_length(website) <= 200);
alter table companies add column if not exists city text check (char_length(city) <= 80);

-- 2) Suivi de candidature : jeton secret (lien envoyé par email) et première ouverture par l'équipe RH
alter table applications add column if not exists track_token uuid not null default gen_random_uuid();
create unique index if not exists applications_track_token_key on applications (track_token);
alter table applications add column if not exists viewed_at timestamptz;

-- 3) Modèles d'emails (un par entreprise, type et langue)
create table email_templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  kind text not null check (kind in ('reject', 'invite', 'offer')),
  locale text not null check (locale in ('en', 'fr', 'ar')),
  subject text not null check (char_length(subject) between 1 and 150),
  body text not null check (char_length(body) between 1 and 3000),
  updated_at timestamptz not null default now(),
  unique (company_id, kind, locale)
);
alter table email_templates enable row level security;
create policy "staff lit modèles" on email_templates for select
  using (current_role_name() is not null and company_id = current_company_id());
create policy "admin écrit modèles" on email_templates for all
  using (current_role_name() in ('super_admin', 'admin') and company_id = current_company_id())
  with check (current_role_name() in ('super_admin', 'admin') and company_id = current_company_id());

-- 4) Messagerie RH <-> candidat (le candidat passe par son lien secret, côté serveur)
create table messages (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications(id) on delete cascade,
  sender text not null check (sender in ('hr', 'candidate')),
  sender_name text,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index on messages (application_id, created_at);
alter table messages enable row level security;
create policy "staff lit messages" on messages for select
  using (current_role_name() is not null and app_in_my_company(application_id));
create policy "staff écrit messages" on messages for insert
  with check (current_role_name() is not null and sender = 'hr' and app_in_my_company(application_id));
create policy "staff marque lu" on messages for update
  using (current_role_name() is not null and app_in_my_company(application_id));

-- 5) Notifications de l'entreprise (cloche). Chaque utilisateur retient la date de sa dernière lecture.
create table notifications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  kind text not null check (kind in ('application', 'message')),
  application_id uuid references applications(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index on notifications (company_id, created_at desc);
alter table notifications enable row level security;
create policy "staff lit notifications" on notifications for select
  using (current_role_name() is not null and company_id = current_company_id());

alter table profiles add column if not exists notifications_seen_at timestamptz not null default now();

-- 6) Vues des offres (une ligne par visite de la page de l'offre)
create table job_views (
  id uuid primary key default gen_random_uuid(),
  job_form_id uuid not null references job_forms(id) on delete cascade,
  viewed_at timestamptz not null default now()
);
create index on job_views (job_form_id, viewed_at);
alter table job_views enable row level security;
create policy "staff lit vues" on job_views for select
  using (current_role_name() is not null and in_my_company(job_form_id));
