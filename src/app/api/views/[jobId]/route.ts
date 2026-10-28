import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Compte une visite de la page d'une offre (appelée par le navigateur, une fois par session).
export async function POST(_req: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  if (!UUID.test(jobId)) return NextResponse.json({ ok: false }, { status: 400 });
  if (!(await rateLimit("job-view", 120, 3600))) return NextResponse.json({ ok: false }, { status: 429 });
  const { error } = await createAdminClient().from("job_views").insert({ job_form_id: jobId });
  return NextResponse.json({ ok: !error }, { status: error ? 404 : 200 });
}
