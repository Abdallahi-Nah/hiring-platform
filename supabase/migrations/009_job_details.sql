-- Informations affichées et filtrables sur la page publique des offres
alter table job_forms
  add column department text,
  add column location text,
  add column work_mode text check (work_mode in ('onsite', 'hybrid', 'remote')),
  add column employment_type text check (employment_type in ('full_time', 'part_time', 'contract', 'internship'));
