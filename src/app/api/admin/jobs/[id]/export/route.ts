import { getCurrentUser } from "@/lib/auth";
import { applyFilters, loadCandidates, parseFilters } from "@/lib/candidate-list";
import { buildPdfTable, buildTable, toCsv, toPdf, toXlsx, type Scope } from "@/lib/export";
import { getI18n, makeT } from "@/i18n/server";
import { createClient } from "@/lib/supabase/server";

const FORMATS = ["csv", "xlsx", "pdf"] as const;
const SCOPES: Scope[] = ["full", "filtered", "summary"];
const CONTENT_TYPES = {
  csv: "text/csv; charset=utf-8",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pdf: "application/pdf",
};

const json = (error: string, status: number) => Response.json({ error }, { status });

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return json("Not signed in.", 401);
  const { t, locale } = await getI18n();
  // La police du PDF ne contient pas l'arabe : le PDF garde des libellés anglais dans ce cas.
  const pdfT = locale === "ar" ? makeT("en") : t;

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return json("Invalid job.", 400);

  const query = new URL(req.url).searchParams;
  const get = (k: string) => query.get(k) ?? "";
  const format = get("format") as (typeof FORMATS)[number];
  const scope = get("scope") as Scope;
  if (!FORMATS.includes(format) || !SCOPES.includes(scope)) return json("Invalid export options.", 400);

  // Lecture avec le compte de l'utilisateur : les règles RLS s'appliquent.
  const data = await loadCandidates(await createClient(), id);
  if (!data) return json("Job not found.", 404);

  let rows = data.rows;
  if (scope === "filtered") rows = applyFilters(rows, parseFilters(get));
  if (scope === "summary") {
    rows = rows.filter((r) => r.status !== "incomplete").sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  }

  let body: string | Buffer;
  if (format === "pdf") {
    body = await toPdf(buildPdfTable(rows, pdfT), `${data.job.title} - ${pdfT("admin.candidates.applications")}`);
  } else {
    const table = buildTable(rows, data.questions, scope, user.role === "reviewer", t);
    body = format === "csv" ? toCsv(table) : await toXlsx(table);
  }

  const slug = data.job.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "job";
  const date = new Date().toISOString().slice(0, 10);
  return new Response(typeof body === "string" ? body : new Uint8Array(body), {
    headers: {
      "Content-Type": CONTENT_TYPES[format],
      "Content-Disposition": `attachment; filename="candidates-${slug}-${scope}-${date}.${format}"`,
      "Cache-Control": "no-store",
    },
  });
}
