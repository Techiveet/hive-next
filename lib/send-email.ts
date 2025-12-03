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

// ✅ import your account email template + types
import {
  UserAccountEmail,
  getUserAccountSubject,
  type UserAccountKind,
  type UserStatus,
} from "@/emails/user-account-template";

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
        // ✅ FIX: Change 'reply_to' to 'replyTo' (camelCase)
        replyTo: replyTo, 
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

    const attachments: any[] = [];

    // Attach logo and replace URL with CID
    if (emailHtml && emailHtml.includes("/logo/logo.png")) {
      const logoPath = path.join(process.cwd(), "public", "logo", "logo.png");

      if (fs.existsSync(logoPath)) {
        attachments.push({
          filename: "logo.png",
          path: logoPath,
          cid: "hive-logo",
        });

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
      attachments,
    });

    console.log("✅ [EMAIL SENT via SMTP]", {
      messageId: info.messageId,
      accepted: info.accepted,
    });
  } catch (error) {
    console.error("❌ [EMAIL SEND ERROR via SMTP]", error);
  }
}

/* ----------------------------------------------------------
 * High-level helper: sendAccountEmail (used by central admin)
 * -------------------------------------------------------- */

type AccountEmailType =
  | "account_created"
  | "account_updated"
  | "account_status_changed";

type BasePayload = {
  name?: string | null;
  email: string;
};

type AccountCreatedPayload = BasePayload & {
  tempPassword?: string | null;
};

type AccountUpdatedPayload = BasePayload;

type AccountStatusChangedPayload = BasePayload & {
  isActive: boolean;
};

type SendAccountEmailArgs =
  | {
      to: string;
      type: "account_created";
      payload: AccountCreatedPayload;
    }
  | {
      to: string;
      type: "account_updated";
      payload: AccountUpdatedPayload;
    }
  | {
      to: string;
      type: "account_status_changed";
      payload: AccountStatusChangedPayload;
    };

export async function sendAccountEmail(args: SendAccountEmailArgs) {
  const { to, type, payload } = args;

  let kind: UserAccountKind;
  let status: UserStatus;
  let password: string | undefined;

  switch (type) {
    case "account_created":
      kind = "created";
      status = "ACTIVE";
      password = payload.tempPassword ?? undefined;
      break;

    case "account_updated":
      kind = "updated";
      status = "ACTIVE";
      password = undefined;
      break;

    case "account_status_changed":
      kind = payload.isActive ? "updated" : "deactivated";
      status = payload.isActive ? "ACTIVE" : "INACTIVE";
      password = undefined;
      break;

    default: {
      const _never: AccountEmailType = type;
      throw new Error(`Unsupported account email type: ${_never}`);
    }
  }

  await sendEmail({
    to,
    subject: getUserAccountSubject(kind),
    react: React.createElement(UserAccountEmail, {
      kind,
      name: payload.name || payload.email,
      email: payload.email,
      password,
      status,
    }),
  });
}
