-- Plateforme multi-entreprises : chaque entreprise ne voit que ses propres données.

-- 1) Entreprises
create table companies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 50),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table companies enable row level security;

-- Première entreprise : reçoit toutes les données existantes (à renommer ensuite dans l'application).
insert into companies (name, slug) values ('Default company', 'default');

-- 2) Profils et offres rattachés à une entreprise
alter table profiles add column company_id uuid references companies(id) on delete restrict;
alter table profiles add column is_platform_admin boolean not null default false;
update profiles set company_id = (select id from companies where slug = 'default');
alter table profiles alter column company_id set not null;
-- Le propriétaire de la plateforme : le compte d'origine. Remplacez l'adresse par la vôtre avant d'exécuter ce fichier
-- (ou voir le README : commande à lancer après la création de votre compte).
update profiles set is_platform_admin = true
  where id = (select id from auth.users where email = 'owner@example.com');
create index on profiles (company_id);

alter table job_forms add column company_id uuid references companies(id) on delete cascade;
update job_forms set company_id = (select id from companies where slug = 'default');
alter table job_forms alter column company_id set not null;
create index on job_forms (company_id);

-- 3) Aides RLS (security definer : pas de boucle sur profiles)
create function current_company_id() returns uuid
language sql stable security definer set search_path = public as $$
  select company_id from profiles where id = auth.uid()
$$;

create function in_my_company(p_job_form_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from job_forms f
    where f.id = p_job_form_id and f.company_id = current_company_id()
  )
$$;

create function app_in_my_company(p_application_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from applications a
    join job_forms f on f.id = a.job_form_id
    where a.id = p_application_id and f.company_id = current_company_id()
  )
$$;

-- 4) Nouvelles règles : tout est limité à l'entreprise de l'utilisateur
drop policy "voir son profil ou super admin" on profiles;
drop policy "super admin gère profils" on profiles;
create policy "voir son profil ou son entreprise" on profiles for select
  using (id = auth.uid() or (current_role_name() = 'super_admin' and company_id = current_company_id()));
create policy "super admin gère son entreprise" on profiles for all
  using (current_role_name() = 'super_admin' and company_id = current_company_id() and not is_platform_admin)
  with check (current_role_name() = 'super_admin' and company_id = current_company_id() and not is_platform_admin);

create policy "voir son entreprise" on companies for select
  using (id = current_company_id());
create policy "super admin modifie son entreprise" on companies for update
  using (id = current_company_id() and current_role_name() = 'super_admin')
  with check (id = current_company_id());

drop policy "staff voit forms" on job_forms;
drop policy "admin gère forms" on job_forms;
create policy "staff voit forms" on job_forms for select
  using (current_role_name() is not null and company_id = current_company_id());
create policy "admin gère forms" on job_forms for all
  using (current_role_name() in ('super_admin', 'admin') and company_id = current_company_id())
  with check (current_role_name() in ('super_admin', 'admin') and company_id = current_company_id());

drop policy "staff voit questions" on questions;
drop policy "admin gère questions" on questions;
create policy "staff voit questions" on questions for select
  using (
    in_my_company(job_form_id)
    and (current_role_name() in ('super_admin', 'admin') or (current_role_name() = 'reviewer' and not is_salary))
  );
create policy "admin gère questions" on questions for all
  using (current_role_name() in ('super_admin', 'admin') and in_my_company(job_form_id))
  with check (current_role_name() in ('super_admin', 'admin') and in_my_company(job_form_id));

drop policy "staff lit candidatures" on applications;
create policy "staff lit candidatures" on applications for select
  using (current_role_name() is not null and in_my_company(job_form_id));

drop policy "admin lit réponses" on answers;
drop policy "reviewer lit réponses non salaire" on answers;
create policy "admin lit réponses" on answers for select
  using (current_role_name() in ('super_admin', 'admin') and app_in_my_company(application_id));
create policy "reviewer lit réponses non salaire" on answers for select
  using (
    current_role_name() = 'reviewer' and app_in_my_company(application_id)
    and not exists (select 1 from questions q where q.id = question_id and q.is_salary)
  );

drop policy "staff lit cv" on resumes;
create policy "staff lit cv" on resumes for select
  using (current_role_name() is not null and app_in_my_company(application_id));
drop policy "staff lit profils externes" on external_profiles;
create policy "staff lit profils externes" on external_profiles for select
  using (current_role_name() is not null and app_in_my_company(application_id));
drop policy "staff lit devoirs" on assignments;
create policy "staff lit devoirs" on assignments for select
  using (current_role_name() is not null and app_in_my_company(application_id));
drop policy "staff lit entretiens" on interviews;
create policy "staff lit entretiens" on interviews for select
  using (current_role_name() is not null and app_in_my_company(application_id));
drop policy "admin gère entretiens" on interviews;
create policy "admin gère entretiens" on interviews for insert
  with check (current_role_name() is not null and app_in_my_company(application_id));
drop policy "staff lit éval IA" on ai_evaluations;
create policy "staff lit éval IA" on ai_evaluations for select
  using (current_role_name() is not null and app_in_my_company(application_id));
drop policy "staff lit éval RH" on hr_evaluations;
create policy "staff lit éval RH" on hr_evaluations for select
  using (current_role_name() is not null and app_in_my_company(application_id));
drop policy "staff écrit éval RH" on hr_evaluations;
create policy "staff écrit éval RH" on hr_evaluations for insert
  with check (current_role_name() is not null and app_in_my_company(application_id));
drop policy "staff modifie éval RH" on hr_evaluations;
create policy "staff modifie éval RH" on hr_evaluations for update
  using (current_role_name() is not null and app_in_my_company(application_id))
  with check (app_in_my_company(application_id));

-- 5) Fermer deux accès devenus dangereux entre entreprises :
--    la vue (elle contournait les règles) et la lecture directe des fichiers (le serveur utilise des liens signés).
drop view if exists reviewer_answers;
drop policy if exists "staff lit fichiers" on storage.objects;
