import { redirect } from "next/navigation";
import { connection } from "next/server";
import { AuthShell } from "@/components/ui/AuthShell";
import { getI18n } from "@/i18n/server";
import { getCandidate, getStaffEmail } from "@/lib/candidate-auth";
import { StaffNotice } from "../StaffNotice";
import { safeNext } from "@/lib/safe-next";
import { CandidateRegisterForm } from "./CandidateRegisterForm";

export const instant = false;

export default async function CandidateRegisterPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const { t } = await getI18n();
  const sp = await searchParams;
  const next = safeNext(sp.next, "/me/profile");
  if (await getCandidate()) redirect(next);
  const staffEmail = await getStaffEmail();
  return (
    <AuthShell title={t("cand.register.title")} subtitle={t("cand.register.subtitle")}>
      {staffEmail ? <StaffNotice email={staffEmail} /> : <CandidateRegisterForm next={next} />}
    </AuthShell>
  );
}
