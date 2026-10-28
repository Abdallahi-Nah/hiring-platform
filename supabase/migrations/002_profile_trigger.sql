-- Crée un profil "reviewer" pour chaque nouvel utilisateur
create function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, role, full_name)
  values (new.id, 'reviewer', new.raw_user_meta_data->>'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Après avoir créé ton premier compte (Authentication > Users),
-- remplace l'email puis lance :
-- insert into profiles (id, role) select id, 'super_admin' from auth.users
--   where email = 'TON_EMAIL' on conflict (id) do update set role = 'super_admin';
