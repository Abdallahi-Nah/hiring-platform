import nodemailer from "nodemailer";

export const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const oneLine = (s: string) => s.replace(/[\r\n]+/g, " ").trim();

// Envoi par Gmail SMTP. Lance une erreur si Gmail n'est pas configuré ou si l'envoi échoue.
// fromName : nom affiché de l'expéditeur (le nom de l'entreprise) ; l'adresse reste celle de la plateforme.
export async function sendMail(mail: { to: string | string[]; subject: string; html: string; text: string; fromName?: string }) {
  const { fromName, ...message } = mail;
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) throw new Error("GMAIL_USER or GMAIL_APP_PASSWORD is not set");

  const transport = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user, pass },
  });
  const name = fromName ? fromName.replace(/[\r\n"<>]+/g, " ").trim().slice(0, 80) : "";
  const from = process.env.EMAIL_FROM ?? `${name || "Hiring Platform"} <${user}>`;
  await transport.sendMail({ from, ...message });
}
