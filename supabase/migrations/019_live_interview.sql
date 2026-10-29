-- Entretien en direct (visio WebRTC entre un RH et le candidat). La vidéo ne passe jamais par nos serveurs
-- et rien n'est enregistré : cette table garde seulement le rendez-vous et son lien privé.

create table live_interviews (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null unique references applications(id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  scheduled_at timestamptz not null,
  duration_minutes int not null default 30 check (duration_minutes between 10 and 120),
  locale text not null default 'en' check (locale in ('en', 'fr', 'ar')),
  status text not null default 'scheduled' check (status in ('scheduled', 'in_progress', 'ended', 'cancelled')),
  invited_at timestamptz,
  guest_joined_at timestamptz,
  ended_at timestamptz,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table live_interviews enable row level security;
create policy "staff lit entretiens en direct" on live_interviews for select
  using (current_role_name() is not null and app_in_my_company(application_id));

-- La cloche prévient l'équipe quand le candidat entre dans la salle
alter table notifications drop constraint if exists notifications_kind_check;
alter table notifications add constraint notifications_kind_check check (kind in ('application', 'message', 'interview', 'live'));
