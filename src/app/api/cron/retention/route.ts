import { createAdminClient } from "@/lib/supabase/admin";

// Durée de conservation annoncée sur /privacy.
const RETENTION_MONTHS = 12;
const BATCH = 50;
const MAX_BATCHES = 20;

// Appelée chaque jour par le Cron Vercel (en-tête Authorization: Bearer CRON_SECRET).
// Supprime les candidatures trop anciennes, avec leurs fichiers (CV, voix, entretiens).
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createAdminClient();
  const limit = new Date();
  limit.setMonth(limit.getMonth() - RETENTION_MONTHS);

  let deleted = 0;
  for (let i = 0; i < MAX_BATCHES; i++) {
    const { data: apps, error } = await db
      .from("applications")
      .select("id")
      .lt("created_at", limit.toISOString())
      .limit(BATCH);
    if (error) return Response.json({ error: error.message, deleted }, { status: 500 });
    if (!apps?.length) break;
    const ids = apps.map((a) => a.id);

    const [{ data: audio }, { data: cvs }, { data: interviews }, { data: videos }] = await Promise.all([
      db.from("answers").select("audio_url").in("application_id", ids).not("audio_url", "is", null),
      db.from("resumes").select("file_url").in("application_id", ids),
      db.from("interviews").select("media_url").in("application_id", ids).not("media_url", "is", null),
      db.from("ai_interview_answers").select("video_path, ai_interviews!inner(application_id)").in("ai_interviews.application_id", ids),
    ]);
    const files: [string, string[]][] = [
      ["audio", (audio ?? []).map((r) => r.audio_url as string)],
      ["resumes", (cvs ?? []).map((r) => r.file_url as string)],
      ["interviews", (interviews ?? []).map((r) => r.media_url as string)],
      ["ai-interviews", (videos ?? []).map((r) => r.video_path as string)],
    ];
    // Si un fichier ne peut pas être supprimé, on garde la candidature : elle sera reprise demain.
    for (const [bucket, paths] of files) {
      if (!paths.length) continue;
      const { error: rmError } = await db.storage.from(bucket).remove(paths);
      if (rmError) return Response.json({ error: rmError.message, deleted }, { status: 500 });
    }

    const { error: delError } = await db.from("applications").delete().in("id", ids);
    if (delError) return Response.json({ error: delError.message, deleted }, { status: 500 });
    deleted += ids.length;
  }
  return Response.json({ deleted });
}
