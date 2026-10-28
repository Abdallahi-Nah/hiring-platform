import { sendJobAlerts } from "@/lib/email/alerts";
import { siteUrl } from "@/lib/site-url";

// Appelée chaque jour par le Cron Vercel (en-tête Authorization: Bearer CRON_SECRET).
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const sent = await sendJobAlerts(await siteUrl());
  return Response.json({ sent });
}
