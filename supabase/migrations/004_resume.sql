-- Un seul CV par candidature (remplaçable) et un seul enregistrement par lien
alter table resumes add constraint resumes_application_unique unique (application_id);
alter table external_profiles add constraint external_profiles_app_url_unique unique (application_id, url);
