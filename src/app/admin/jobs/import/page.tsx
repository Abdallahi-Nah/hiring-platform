import Link from "next/link";
import { connection } from "next/server";
import { getI18n } from "@/i18n/server";
import { requireUser } from "@/lib/auth";
import { MAX_IMPORT_ROWS, TEMPLATE_COLUMNS } from "@/lib/jobs/csv";
import { ImportForm } from "./ImportForm";

export const instant = false;

export default async function ImportJobsPage() {
  await connection();
  await requireUser(["super_admin", "admin"]);
  const { t } = await getI18n();
  return (
    <div className="grid max-w-4xl gap-5">
      <div>
        <Link href="/admin/jobs" className="hint hover:underline">
          <span className="inline-block rtl:rotate-180">←</span> {t("admin.jobs.title")}
        </Link>
        <h1 className="title mt-1">{t("imp.title")}</h1>
        <p className="hint mt-1">{t("imp.subtitle")}</p>
      </div>

      <section className="card grid gap-3" aria-labelledby="fmt-h">
        <h2 id="fmt-h" className="sub-title">{t("imp.formatTitle")}</h2>
        <p className="hint">{t("imp.formatHint", { max: MAX_IMPORT_ROWS })}</p>
        <div className="overflow-x-auto">
          <table className="w-full text-start text-sm">
            <thead>
              <tr className="text-muted">
                <th className="py-1.5 pe-3 text-start font-semibold">{t("imp.colName")}</th>
                <th className="py-1.5 text-start font-semibold">{t("imp.colHelp")}</th>
              </tr>
            </thead>
            <tbody>
              {TEMPLATE_COLUMNS.map((c) => (
                <tr key={c} className="border-t border-line align-top">
                  <td className="py-1.5 pe-3"><code className="font-semibold">{c}</code></td>
                  <td className="py-1.5">{t(`imp.col.${c}` as "imp.col.title")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <ImportForm />
    </div>
  );
}
