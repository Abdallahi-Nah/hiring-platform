-- 1) Plus de rôle automatique : un nouveau compte n'a AUCUN accès tant qu'un Super Admin
--    ne lui donne pas un rôle (l'invitation crée le profil).
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists handle_new_user();

-- 2) Les formulaires et les questions ne sont plus lisibles par le public.
--    La page de candidature les lit côté serveur, avec seulement les colonnes utiles.
drop policy if exists "public voit forms actifs" on job_forms;
create policy "staff voit forms" on job_forms for select
  using (current_role_name() is not null);

drop policy if exists "public voit questions des forms actifs" on questions;
create policy "staff voit questions" on questions for select
  using (
    current_role_name() in ('super_admin', 'admin')
    or (current_role_name() = 'reviewer' and not is_salary)
  );

-- 3) Limite de demandes par adresse IP (routes publiques de candidature)
create table rate_limits (
  key text primary key,
  window_start timestamptz not null default now(),
  count int not null default 0
);
alter table rate_limits enable row level security; -- aucune règle : seul le serveur (service role) y accède

create function check_rate_limit(p_key text, p_max int, p_window_seconds int)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  c int;
begin
  insert into rate_limits (key, window_start, count)
  values (p_key, now(), 1)
  on conflict (key) do update set
    count = case
      when rate_limits.window_start < now() - make_interval(secs => p_window_seconds) then 1
      else rate_limits.count + 1 end,
    window_start = case
      when rate_limits.window_start < now() - make_interval(secs => p_window_seconds) then now()
      else rate_limits.window_start end
  returning count into c;
  return c <= p_max;
end;
$$;
revoke execute on function check_rate_limit(text, int, int) from public, anon, authenticated;
