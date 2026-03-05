import nodemailer from "nodemailer";

export type EmailAttachment = {
  filename: string;
  content: Buffer;
  cid?: string;
};

export function getMailTransporter() {
  const user = process.env.EMAIL_USER?.trim();
  const pass = process.env.APP_PASSWORD?.trim();
  if (!user || !pass) {
    throw new Error("Missing EMAIL_USER or APP_PASSWORD in env");
  }
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: { user, pass },
  });
}

export async function sendMail(options: {
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: EmailAttachment[];
}): Promise<void> {
  const user = process.env.EMAIL_USER?.trim();
  if (!user) throw new Error("Missing EMAIL_USER");
  const transporter = getMailTransporter();
  await transporter.sendMail({
    from: `"Store" <${user}>`,
    to: options.to,
    subject: options.subject,
    text: options.text,
    html: options.html ?? options.text.replace(/\n/g, "<br>"),
    attachments: options.attachments,
  });
}
