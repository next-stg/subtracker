import "server-only";

import nodemailer, { type Transporter } from "nodemailer";

import { formatMoney } from "@/lib/constants";

export type RenewalEmail = {
  to: string;
  username: string;
  subscriptionName: string;
  amount: string;
  currency: string;
  billingDate: string;
  appUrl: string;
};

export type SmtpConfiguration = {
  host: string;
  port: number;
  user: string;
  password: string;
};

export function createSmtpTransporter(configuration: SmtpConfiguration): Transporter {
  return nodemailer.createTransport({
    host: configuration.host,
    port: configuration.port,
    secure: configuration.port === 465,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 30_000,
    auth: {
      user: configuration.user,
      pass: configuration.password,
    },
  });
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

export async function sendRenewalEmail(transporter: Transporter, from: string, email: RenewalEmail) {
  const subscriptionName = email.subscriptionName.replace(/[\r\n]/g, " ").trim();
  const recipientName = email.username.replace(/[\r\n]/g, " ").trim();
  const dueDate = new Date(`${email.billingDate}T00:00:00Z`).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const amount = formatMoney(email.amount, email.currency);
  const url = `${email.appUrl.replace(/\/$/, "")}/subscriptions`;
  const safeName = escapeHtml(subscriptionName);
  const safeRecipientName = escapeHtml(recipientName);
  const safeAmount = escapeHtml(amount);
  const safeDueDate = escapeHtml(dueDate);
  const safeUrl = escapeHtml(url);

  return transporter.sendMail({
    from,
    to: email.to,
    subject: `Rappel de renouvellement : ${subscriptionName}`,
    text: `Bonjour ${recipientName},\n\nL'abonnement ${subscriptionName} (${amount}) sera renouvelé le ${dueDate}.\n\nConsulter mes abonnements : ${url}`,
    html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#17202a;max-width:560px;margin:0 auto;padding:24px"><h1 style="font-size:22px">Rappel de renouvellement</h1><p>Bonjour ${safeRecipientName || ""},</p><p>Votre abonnement <strong>${safeName}</strong> (${safeAmount}) sera renouvelé le <strong>${safeDueDate}</strong>.</p><p><a href="${safeUrl}" style="display:inline-block;background:#087f5b;color:#fff;padding:12px 18px;text-decoration:none;border-radius:6px">Consulter mes abonnements</a></p><p style="font-size:12px;color:#667085">Vous recevez ce message selon vos préférences de rappel dans SubTracker.</p></div>`,
  });
}

export async function sendPasswordResetEmail(
  transporter: Transporter,
  from: string,
  to: string,
  username: string,
  resetUrl: string
) {
  const recipientName = username.replace(/[\r\n]/g, " ").trim();
  const safeRecipientName = escapeHtml(recipientName);
  const safeUrl = escapeHtml(resetUrl);

  return transporter.sendMail({
    from,
    to,
    subject: "Réinitialisation de votre mot de passe SubTracker",
    text: `Bonjour ${recipientName},\n\nUne demande de réinitialisation du mot de passe de votre compte SubTracker a été effectuée. Ce lien est valable une heure :\n${resetUrl}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez ce message.`,
    html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#17202a;max-width:560px;margin:0 auto;padding:24px"><h1 style="font-size:22px">Réinitialiser votre mot de passe</h1><p>Bonjour ${safeRecipientName || ""},</p><p>Une demande de réinitialisation du mot de passe de votre compte SubTracker a été effectuée. Ce lien est valable une heure.</p><p><a href="${safeUrl}" style="display:inline-block;background:#087f5b;color:#fff;padding:12px 18px;text-decoration:none;border-radius:6px">Choisir un nouveau mot de passe</a></p><p>Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.</p></div>`,
  });
}