import { connection } from "next/server";
import { employmentLabel, workModeLabel } from "@/i18n/labels";
import { getI18n } from "@/i18n/server";
import { requireCandidate } from "@/lib/candidate-auth";
import { createClient } from "@/lib/supabase/server";
import { AlertForm, AlertItem } from "./AlertForm";

export const instant = false;

export default async function AlertsPage() {
  await connection();
  const me = await requireCandidate("/me/alerts");
  const { t } = await getI18n();
  const { data } = await (await createClient())
    .from("job_alerts")
    .select("id, query, location, employment_type, work_mode, min_salary")
    .eq("user_id", me.id)
    .order("created_at", { ascending: false });

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="title">{t("cand.alerts.title")}</h1>
        <p className="hint mt-1">{t("cand.alerts.subtitle")}</p>
      </div>
      {(data ?? []).length === 0 && <p className="card text-center hint">{t("cand.alerts.none")}</p>}
      {(data ?? []).map((a) => {
        const parts = [
          a.query,
          a.location,
          a.employment_type && employmentLabel(t, a.employment_type),
          a.work_mode && workModeLabel(t, a.work_mode),
          a.min_salary != null && t("cand.alerts.salaryFrom", { n: a.min_salary }),
        ].filter(Boolean) as string[];
        return <AlertItem key={a.id} id={a.id} summary={parts.join(" · ")} />;
      })}
      {(data ?? []).length < 5 && <AlertForm />}
    </div>
  );
}
