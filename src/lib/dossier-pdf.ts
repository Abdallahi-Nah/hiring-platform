import path from "node:path";
import PDFDocument from "pdfkit";

// Police avec l'arabe : pdfkit (fontkit) relie lui-même les lettres et gère le sens droite-gauche.
const FONT = path.join(process.cwd(), "src/lib/fonts/DejaVuSans.ttf");
const FONT_BOLD = path.join(process.cwd(), "src/lib/fonts/DejaVuSans-Bold.ttf");
// Entre deux mots arabes, pdfkit perd l'espace simple : l'espace insécable s'affiche correctement.
const pdfText = (s: string) => s.replace(/(?<=[؀-ۿ]) (?=[؀-ۿ])/g, " ");

export type Block =
  | { kind: "title"; text: string; sub?: string }
  | { kind: "section"; text: string }
  | { kind: "line"; label?: string; text: string }
  | { kind: "list"; label: string; items: string[] };

// Dossier d'un candidat en PDF (A4, une colonne). Les blocs sont déjà traduits : ce fichier ne fait que la mise en page.
export function buildDossierPdf(blocks: Block[], rtl: boolean, footer: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 48, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const align = rtl ? "right" : "left";
    const width = doc.page.width - 96;
    const room = (h: number) => {
      if (doc.y + h > doc.page.height - 70) doc.addPage();
    };

    for (const b of blocks) {
      if (b.kind === "title") {
        doc.font(FONT_BOLD).fontSize(20).fillColor("#111111").text(pdfText(b.text), { align, width });
        if (b.sub) doc.moveDown(0.2).font(FONT).fontSize(10).fillColor("#555555").text(pdfText(b.sub), { align, width });
        doc.moveDown(0.8);
      } else if (b.kind === "section") {
        room(60);
        doc.moveDown(0.6).font(FONT_BOLD).fontSize(13).fillColor("#00b141").text(pdfText(b.text), { align, width });
        doc.moveTo(48, doc.y + 2).lineTo(48 + width, doc.y + 2).strokeColor("#dddddd").lineWidth(0.7).stroke();
        doc.moveDown(0.5);
      } else if (b.kind === "line") {
        room(30);
        if (b.label) doc.font(FONT_BOLD).fontSize(10).fillColor("#222222").text(pdfText(b.label), { align, width, continued: false });
        doc.font(FONT).fontSize(10).fillColor("#222222").text(pdfText(b.text), { align, width });
        doc.moveDown(0.3);
      } else {
        room(40);
        doc.font(FONT_BOLD).fontSize(10).fillColor("#222222").text(pdfText(b.label), { align, width });
        doc.font(FONT).fontSize(10);
        for (const it of b.items) {
          room(18);
          doc.text(pdfText(`• ${it}`), { align, width });
        }
        doc.moveDown(0.3);
      }
    }

    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      // Le pied de page est écrit dans la marge du bas : sans cela pdfkit ajouterait une page vide.
      doc.page.margins.bottom = 0;
      doc.font(FONT).fontSize(8).fillColor("#888888").text(pdfText(`${footer} · ${i + 1}/${range.count}`), 48, doc.page.height - 40, { align: "center", width, lineBreak: false });
    }
    doc.end();
  });
}
