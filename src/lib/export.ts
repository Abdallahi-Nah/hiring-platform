import ExcelJS from "exceljs";
import path from "node:path";
import PDFDocument from "pdfkit";
import type { CandidateRow, QuestionCol } from "@/lib/candidate-list";
import { decisionLabel, recommendationLabel, statusLabel } from "@/i18n/labels";
import type { TFunction } from "@/i18n/translate";

export type Cell = string | number | null;
export type Table = { headers: string[]; rows: Cell[][] };
export type Scope = "full" | "filtered" | "summary";

const summaryHeaders = (t: TFunction) => [
  t("admin.export.name"),
  t("admin.export.email"),
  t("admin.export.status"),
  t("admin.export.aiScore"),
  t("admin.export.rank"),
  t("admin.export.aiRecommendation"),
  t("admin.export.hrScore"),
  t("admin.export.hrDecision"),
];
const summaryCells = (r: CandidateRow, t: TFunction): Cell[] => [
  r.name,
  r.email,
  statusLabel(t, r.status),
  r.score,
  r.rank,
  recommendationLabel(t, r.recommendation) || null,
  r.hrScore,
  decisionLabel(t, r.hrDecision) || null,
];

// Le salaire n'est jamais exporté pour un Reviewer (en plus des règles RLS).
export function buildTable(
  rows: CandidateRow[],
  questions: QuestionCol[],
  scope: Scope,
  isReviewer: boolean,
  t: TFunction
): Table {
  if (scope === "summary") {
    return { headers: summaryHeaders(t), rows: rows.map((r) => summaryCells(r, t)) };
  }

  const cols = questions.filter((q) => q.type !== "file_upload" && !(isReviewer && q.is_salary));
  return {
    headers: [
      t("admin.export.name"),
      t("admin.export.email"),
      t("admin.export.phone"),
      t("admin.export.status"),
      t("admin.export.duplicate"),
      t("admin.export.appliedOn"),
      t("admin.export.years"),
      t("admin.export.skills"),
      t("admin.export.aiScore"),
      t("admin.export.rank"),
      t("admin.export.aiRecommendation"),
      t("admin.export.hrScore"),
      t("admin.export.hrDecision"),
      t("admin.export.interviewScore"),
      ...cols.map((q) => q.label),
    ],
    rows: rows.map((r) => [
      r.name,
      r.email,
      r.phone,
      statusLabel(t, r.status),
      r.is_duplicate ? t("admin.export.yes") : t("admin.export.no"),
      r.created_at.slice(0, 10),
      r.years,
      r.skills.join(", "),
      r.score,
      r.rank,
      recommendationLabel(t, r.recommendation) || null,
      r.hrScore,
      decisionLabel(t, r.hrDecision) || null,
      r.interviewScore,
      ...cols.map((q) => r.answers.get(q.id) ?? null),
    ]),
  };
}

// Un texte qui commence par = + - @ peut devenir une formule dans Excel : on le neutralise.
export function safeText(cell: Cell): string | number {
  if (cell == null) return "";
  if (typeof cell === "number") return cell;
  return /^[=+\-@\t\r]/.test(cell) ? `'${cell}` : cell;
}

export function toCsv(table: Table): string {
  const escape = (c: Cell) => {
    const s = String(safeText(c));
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [table.headers, ...table.rows].map((row) => row.map(escape).join(","));
  return `﻿${lines.join("\r\n")}`; // BOM : Excel lit bien l'UTF-8 (arabe, accents)
}

export async function toXlsx(table: Table): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Candidates");
  sheet.addRow(table.headers.map(safeText)).font = { bold: true };
  for (const row of table.rows) sheet.addRow(row.map(safeText));
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: table.headers.length } };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.columns.forEach((col, i) => {
    const longest = Math.max(table.headers[i].length, ...table.rows.map((r) => String(r[i] ?? "").length));
    col.width = Math.min(Math.max(longest + 2, 10), 50);
  });
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

// Le PDF est un tableau compact. La police DejaVu Sans couvre le latin accentué et l'arabe ;
// pdfkit (fontkit) relie lui-même les lettres arabes et gère le sens droite-gauche.
const FONT = path.join(process.cwd(), "src/lib/fonts/DejaVuSans.ttf");
const FONT_BOLD = path.join(process.cwd(), "src/lib/fonts/DejaVuSans-Bold.ttf");
// Entre deux mots arabes, pdfkit perd l'espace simple : l'espace insécable s'affiche correctement.
// Les espaces à côté du latin restent normaux, sinon le latin s'afficherait à l'envers.
const pdfText = (s: string) => s.replace(/(?<=[\u0600-\u06FF]) (?=[\u0600-\u06FF])/g, "\u00A0");

export function buildPdfTable(rows: CandidateRow[], t: TFunction): Table {
  return {
    headers: [
      t("admin.export.name"),
      t("admin.export.email"),
      t("admin.export.status"),
      t("admin.candidates.years"),
      t("admin.candidates.aiScore"),
      t("admin.export.rank"),
      t("admin.export.aiRecommendation"),
      t("admin.export.hrDecision"),
    ],
    rows: rows.map((r) => [
      r.name,
      r.email,
      statusLabel(t, r.status),
      r.years,
      r.score != null ? `${r.score}%` : null,
      r.rank != null ? `#${r.rank}` : null,
      recommendationLabel(t, r.recommendation) || null,
      decisionLabel(t, r.hrDecision) || null,
    ]),
  };
}

export function toPdf(table: Table, title: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 30 });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const widths = [120, 150, 90, 40, 55, 40, 110, 110]; // total 715 sur 782 utilisables
    const left = 30;
    const rowHeight = 18;
    const bottom = doc.page.height - 40;

    const drawRow = (cells: string[], y: number, bold: boolean) => {
      doc.font(bold ? FONT_BOLD : FONT).fontSize(9);
      let x = left;
      cells.forEach((text, i) => {
        doc.text(pdfText(text), x, y, { width: widths[i] - 6, height: rowHeight, lineBreak: false, ellipsis: true });
        x += widths[i];
      });
    };

    const header = () => {
      doc.font(FONT_BOLD).fontSize(14).text(pdfText(title), left, 30);
      doc.font(FONT).fontSize(9).text(`${table.rows.length} candidates — ${new Date().toISOString().slice(0, 10)}`, left, 50);
      drawRow(table.headers, 72, true);
      doc.moveTo(left, 86).lineTo(left + 715, 86).stroke();
      return 92;
    };

    let y = header();
    for (const row of table.rows) {
      if (y + rowHeight > bottom) {
        doc.addPage();
        y = header();
      }
      drawRow(row.map((c) => String(c ?? "")), y, false);
      y += rowHeight;
    }
    doc.end();
  });
}
