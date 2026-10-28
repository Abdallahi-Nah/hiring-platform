-- Résultats détaillés de l'évaluation IA
alter table ai_evaluations
  add column sub_scores jsonb,
  add column missing_requirements jsonb,
  add column interview_questions jsonb,
  add column assignment_comment text,
  add column rank int;
