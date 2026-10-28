import { connection } from "next/server";
import { getI18n } from "@/i18n/server";
import { requireCandidate } from "@/lib/candidate-auth";
import { createClient } from "@/lib/supabase/server";
import { CvForm } from "./CvForm";
import { ProfileForm } from "./ProfileForm";

export const instant = false;

export default async function ProfilePage() {
  await connection();
  const me = await requireCandidate("/me/profile");
  const { t } = await getI18n();
  const { data: p } = await (await createClient())
    .from("candidate_profiles")
    .select("full_name, phone, headline, skills, experience, education, links, cv_name")
    .eq("user_id", me.id)
    .maybeSingle();

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="title">{t("cand.profile.title")}</h1>
        <p className="hint mt-1">{t("cand.profile.subtitle")}</p>
      </div>
      <CvForm cvName={p?.cv_name ?? null} />
      <ProfileForm
        email={me.email}
        initial={{
          full_name: p?.full_name ?? "",
          phone: p?.phone ?? "",
          headline: p?.headline ?? "",
          skills: p?.skills ?? [],
          experience: (p?.experience as { role: string; company: string; start: string; end: string; description: string }[]) ?? [],
          education: (p?.education as { degree: string; school: string; year: string }[]) ?? [],
          links: p?.links ?? [],
        }}
      />
    </div>
  );
}
