// src/lib/send-email.ts
"use server";

import * as React from "react";

import { Resend } from "resend";
import fs from "fs";
import { getTenantAndUser } from "@/lib/get-tenant-and-user";
import nodemailer from "nodemailer";
import path from "path";
import { prisma } from "@/lib/prisma";
import { render } from "@react-email/components";

const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;

type SendEmailArgs = {
  to: string | string[];
  subject: string;
  react?: React.ReactElement;
  text?: string;
  html?: string;
  fromOverride?: string;
};

async function getEmailConfig() {
  const { tenant } = await getTenantAndUser();
  const tenantId = tenant?.id ?? null;

  const settings = await prisma.emailSettings.findUnique({
    where: { tenantId },
  });

  const provider = (settings?.provider as "RESEND" | "SMTP") ?? "RESEND";

  const fromName = settings?.fromName || "HIVE";
  const fromEmail =
    settings?.fromEmail ||
    process.env.EMAIL_FROM_ADDRESS ||
    "onboarding@resend.dev";

  const replyTo = settings?.replyToEmail || undefined;

  const smtpHost = settings?.smtpHost || process.env.SMTP_HOST;
  const smtpPort = settings?.smtpPort || Number(process.env.SMTP_PORT || 587);
  const smtpUser = settings?.smtpUser || process.env.SMTP_USER;
  const smtpSecurity = settings?.smtpSecurity || "tls";

  return {
    provider,
    fromName,
    fromEmail,
    replyTo,
    smtpHost,
    smtpPort,
    smtpUser,
    smtpSecurity,
  };
}

export async function sendEmail({
  to,
  subject,
  react,
  text,
  html,
  fromOverride,
}: SendEmailArgs) {
  const {
    provider,
    fromName,
    fromEmail,
    replyTo,
    smtpHost,
    smtpPort,
    smtpUser,
    smtpSecurity,
  } = await getEmailConfig();

  const from =
    fromOverride ||
    (process.env.EMAIL_FROM
      ? process.env.EMAIL_FROM
      : `${fromName} <${fromEmail}>`);

  const toList = Array.isArray(to) ? to : [to];

  // ---------------------------
  // RESEND PATH
  // ---------------------------
  if (provider === "RESEND") {
    if (!resend) {
      console.warn(
        "⚠️ [EMAIL] Resend provider selected but RESEND_API_KEY missing.",
        { to: toList, subject }
      );
      return;
    }

    try {
      const result = await resend.emails.send({
        from,
        to: toList,
        subject,
        react,
        html,
        text,
        reply_to: replyTo,
      });
      console.log("✅ [EMAIL SENT via RESEND]", { id: result.data?.id });
    } catch (error) {
      console.error("❌ [EMAIL SEND ERROR via RESEND]", error);
    }
    return;
  }

  // ---------------------------
  // SMTP PATH
  // ---------------------------

  const pass = process.env.SMTP_PASSWORD;

  if (!smtpHost || !smtpPort || !smtpUser || !pass) {
    console.error("❌ [EMAIL] SMTP config incomplete.");
    return;
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: Number(smtpPort),
    secure: smtpSecurity === "ssl" || Number(smtpPort) === 465,
    auth: {
      user: smtpUser,
      pass,
    },
  });

  try {
    // 1. Convert React to HTML
    let emailHtml = html;
    if (!emailHtml && react) {
      emailHtml = await render(react);
    }

    const attachments = [];
    
    // 2. SMTP LOGO MAGIC: 
    // If the HTML contains our local logo URL, attach the file and replace the URL with a CID.
    if (emailHtml && emailHtml.includes("/logo/logo.png")) {
      const logoPath = path.join(process.cwd(), "public", "logo", "logo.png");
      
      // Only attach if file actually exists locally
      if (fs.existsSync(logoPath)) {
        attachments.push({
          filename: "logo.png",
          path: logoPath,
          cid: "hive-logo", // This ID matches the replacement below
        });

        // Regex to replace http://localhost:3000/logo/logo.png with cid:hive-logo
        // We replace any src ending in /logo/logo.png to be safe
        emailHtml = emailHtml.replace(
          /src="[^"]*\/logo\/logo\.png"/g,
          'src="cid:hive-logo"'
        );
      }
    }

    const info = await transporter.sendMail({
      from,
      to: toList,
      subject,
      text,
      html: emailHtml,
      replyTo,
      attachments, // <--- Attach the logo file
    });

    console.log("✅ [EMAIL SENT via SMTP]", {
      messageId: info.messageId,
      accepted: info.accepted,
    });
  } catch (error) {
    console.error("❌ [EMAIL SEND ERROR via SMTP]", error);
  }
}