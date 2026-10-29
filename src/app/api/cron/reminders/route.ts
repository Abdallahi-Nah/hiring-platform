import { sendLiveReminders } from "@/lib/email/live-reminder";
import { siteUrl } from "@/lib/site-url";

// Rappels des entretiens en direct. Le plan gratuit de Vercel n'autorise qu'un cron par jour :
// un service gratuit (cron-job.org) appelle cette adresse toutes les 10 minutes avec l'en-tête Authorization: Bearer CRON_SECRET.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const sent = await sendLiveReminders(await siteUrl());
  return Response.json({ sent });
}
