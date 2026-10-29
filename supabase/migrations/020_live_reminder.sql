-- Rappel par email 1 heure avant l'entretien en direct : on note l'envoi pour ne jamais le faire deux fois.
alter table live_interviews add column reminder_sent_at timestamptz;
