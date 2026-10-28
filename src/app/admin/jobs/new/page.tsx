import { connection } from "next/server";
import Link from "next/link";
import { getI18n } from "@/i18n/server";
import { requireUser } from "@/lib/auth";
import { NewJobForm } from "./NewJobForm";

export const instant = false;

export default async function NewJobPage() {
  await connection(); // rendu à chaque demande (session et heure)
  await requireUser(["super_admin", "admin"]);
  const { t } = await getI18n();
  return (
    <div className="grid max-w-3xl gap-5">
      <div>
        <Link href="/admin/jobs" className="hint hover:underline">
          <span className="inline-block rtl:rotate-180">←</span> {t("admin.jobs.title")}
        </Link>
        <h1 className="title mt-1">{t("admin.jobs.newTitle")}</h1>
      </div>
      <NewJobForm />
    </div>
  );
}
