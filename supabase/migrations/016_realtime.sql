-- Temps réel (WebSocket) : Supabase Realtime envoie les nouvelles lignes aux équipes connectées.
-- Les règles RLS des tables s'appliquent : chaque entreprise ne reçoit que ses propres lignes.
alter publication supabase_realtime add table messages;
alter publication supabase_realtime add table notifications;
