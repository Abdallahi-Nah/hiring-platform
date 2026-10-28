import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

// Cookie de session (disparaît à la fermeture du navigateur) : "appId.page.signature".
// Il prouve que ce navigateur possède la candidature et indique la page en cours.
const cookieName = (jobId: string) => `apply_${jobId}`;

const sign = (payload: string) =>
  createHmac("sha256", process.env.SUPABASE_SERVICE_ROLE_KEY!)
    .update(payload)
    .digest("base64url");

export type ApplySession = { applicationId: string; page: number };

export async function readSession(jobId: string): Promise<ApplySession | null> {
  const raw = (await cookies()).get(cookieName(jobId))?.value;
  if (!raw) return null;
  const [applicationId, page, sig] = raw.split(".");
  if (!applicationId || !page || !sig) return null;

  const expected = Buffer.from(sign(`${applicationId}.${page}`));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
    return null;
  }
  return { applicationId, page: Number(page) };
}

export async function writeSession(jobId: string, s: ApplySession) {
  const payload = `${s.applicationId}.${s.page}`;
  (await cookies()).set(cookieName(jobId), `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}

export async function clearSession(jobId: string) {
  (await cookies()).delete(cookieName(jobId));
}
