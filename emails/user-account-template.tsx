// emails/user-account-template.tsx

import * as React from "react";

import {
  Body,
  Button,
  Column,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Preview,
  Row,
  Section,
  Text,
} from "@react-email/components";

/* ------------------------------------------------------------------
 * Types
 * ------------------------------------------------------------------ */

export type UserStatus = "ACTIVE" | "INACTIVE";
export type UserAccountKind = "created" | "updated" | "deactivated";

export interface UserAccountEmailProps {
  kind: UserAccountKind;
  name?: string | null;
  email: string;
  password?: string;
  status: UserStatus;
  roleName?: string;
  tenantName?: string;
  loginUrl?: string;
  tenantDomain?: string;

  /** Only used for `kind === "updated"` */
  changedName?: boolean;
  changedPassword?: boolean;
  changedRole?: boolean;
}

/* ------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------ */

export function getUserAccountSubject(
  kind: UserAccountKind,
  tenantName?: string
): string {
  const prefix = tenantName ? `Hive • ${tenantName}` : "Hive";

  switch (kind) {
    case "created":
      return `${prefix} • Your account has been created`;
    case "updated":
      return `${prefix} • Your account has been updated`;
    case "deactivated":
      return `${prefix} • Your account has been deactivated`;
    default:
      return `${prefix} • Account notification`;
  }
}

/* ------------------------------------------------------------------
 * Email component
 * ------------------------------------------------------------------ */

export const UserAccountEmail = ({
  kind,
  name,
  email,
  password,
  status,
  roleName,
  tenantName,
  loginUrl,
  changedName,
  changedPassword,
  changedRole,
  tenantDomain,
}: UserAccountEmailProps) => {
  const appUrl =
    loginUrl || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const logoURL = `${
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  }/logo/logo.png`;

  const statusIsActive = status === "ACTIVE";
  const displayName = name || email;
  const displayTenant = tenantName || "Hive";

  let title: string;
  let intro: string;

  if (kind === "created") {
    title = `Welcome to ${displayTenant}`;
    intro =
      "Your admin account has been created. You can sign in using the details below.";
  } else if (kind === "updated") {
    title = "Your admin account was updated";
    intro =
      "Your account details have been updated by an administrator. If this wasn’t you, please contact your admin immediately.";
  } else {
    title = "Your admin account has been deactivated";
    intro =
      "Your account has been deactivated. You will no longer be able to sign in until an administrator re-activates it.";
  }

  const showPasswordBlock = !!password; // only when we explicitly pass it
  const showRoleBlock = !!roleName;

  const hasUpdateDetails =
    kind === "updated" && !!(changedName || changedPassword || changedRole);

  const allUpdated =
    kind === "updated" &&
    !!(changedName && changedPassword && changedRole);

  return (
    <Html>
      <Head />
      <Preview>{getUserAccountSubject(kind, tenantName)}</Preview>

      <Body style={styles.main}>
        <Container style={styles.container}>
          {/* HEADER */}
          <Section style={styles.headerSection}>
            <Row>
              <Column style={{ width: 48 }}>
                <Img
                  src={logoURL}
                  alt="Hive Logo"
                  width="40"
                  height="40"
                  style={styles.logoImage}
                />
              </Column>
              <Column>
                <Heading style={styles.headerTitle}>{displayTenant}</Heading>
                <Text style={styles.headerSubtitle}>
                  Secure access & role-based administration.
                </Text>
              </Column>
            </Row>
          </Section>

          {/* CONTENT */}
          <Section style={styles.contentSection}>
            <Heading as="h2" style={styles.contentTitle}>
              {title}
            </Heading>

            <Text style={styles.contentText}>Hi {displayName},</Text>

            <Text style={styles.contentText}>{intro}</Text>

            {/* STATUS + ROLE */}
            <Row style={{ marginTop: 8, marginBottom: 4 }}>
              <Column>
                <Text style={styles.contentText}>
                  Account status:{" "}
                  <span
                    style={{
                      ...styles.pillBase,
                      ...(statusIsActive
                        ? styles.pillActive
                        : styles.pillInactive),
                    }}
                  >
                    {status}
                  </span>
                </Text>
              </Column>

              {showRoleBlock && (
                <Column style={{ textAlign: "right" }}>
                  <Text style={styles.contentText}>
                    Role: <span style={styles.roleBadge}>{roleName}</span>
                  </Text>
                </Column>
              )}
            </Row>

            {tenantDomain && (
              <Text style={styles.contentText}>
                Workspace domain:{" "}
                <span style={styles.domainBadge}>{tenantDomain}</span>
              </Text>
            )}

            {/* WHAT CHANGED – only for updates */}
            {hasUpdateDetails && (
              <>
                <Text style={styles.sectionLabel}>What changed?</Text>
                <ul style={styles.list}>
                  {allUpdated ? (
                    <li style={styles.listItem}>
                      Your <strong>name</strong>, <strong>role</strong> and{" "}
                      <strong>sign-in password</strong> were updated.
                    </li>
                  ) : (
                    <>
                      {changedName && (
                        <li style={styles.listItem}>
                          Your display <strong>name</strong> was updated.
                        </li>
                      )}
                      {changedRole && (
                        <li style={styles.listItem}>
                          Your assigned <strong>role</strong> is now{" "}
                          <strong>{roleName}</strong>.
                        </li>
                      )}
                      {changedPassword && (
                        <li style={styles.listItem}>
                          Your <strong>sign-in password</strong> was updated.
                        </li>
                      )}
                    </>
                  )}
                </ul>
              </>
            )}

            {/* CREDENTIALS BLOCK (create or password change) */}
            {showPasswordBlock && (
              <Section style={styles.credentialsBox}>
                <Text style={styles.credentialsTitle}>Sign-in details</Text>
                <Text style={styles.credentialsText}>
                  <strong>Email:</strong> {email}
                </Text>
                <Text style={styles.credentialsText}>
                  <strong>
                    {kind === "created" ? "Temporary password" : "New password"}
                    :
                  </strong>{" "}
                  <span style={styles.code}>{password}</span>
                </Text>
                <Text style={styles.credentialsHint}>
                  For security, please sign in and change this password as soon
                  as possible.
                </Text>
              </Section>
            )}

            {/* CTA */}
            {statusIsActive && (
              <Button href={appUrl} style={styles.primaryButton}>
                Open Admin Panel
              </Button>
            )}

            {/* FOOTER NOTE */}
            <Text style={styles.smallNote}>
              If you did not expect this email, you can safely ignore it.
              However, if you suspect any suspicious activity on your account,
              please contact your administrator.
            </Text>

            <Hr style={styles.hr} />

            <Text style={styles.metaText}>
              This email was generated automatically by{" "}
              <span style={{ fontWeight: 600 }}>{displayTenant}</span> when your
              account was{" "}
              {kind === "created"
                ? "created"
                : kind === "updated"
                ? "updated"
                : "deactivated"}
              .
            </Text>
          </Section>

          {/* FOOTER */}
          <Section style={styles.footerSection}>
            <Text style={styles.footerText}>
              You&apos;re receiving this email because your address is linked to
              an admin account in {displayTenant}.
            </Text>
            <Text style={styles.footerTextMuted}>
              &copy; {new Date().getFullYear()} Hive. All rights reserved.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

export default UserAccountEmail;

/* ------------------------------------------------------------------
 * Inline styles
 * ------------------------------------------------------------------ */

const styles: Record<string, React.CSSProperties> = {
  main: {
    backgroundColor: "#f3f4f6",
    margin: 0,
    padding: "24px 0",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },
  container: {
    maxWidth: "620px",
    width: "100%",
    margin: "0 auto",
    backgroundColor: "#ffffff",
    borderRadius: 18,
    border: "1px solid #e5e7eb",
    boxShadow:
      "0 20px 25px -5px rgba(15,23,42,0.08), 0 10px 10px -5px rgba(15,23,42,0.04)",
  },
  headerSection: {
    padding: "20px 24px 14px",
    borderBottom: "1px solid #e5e7eb",
  },
  logoImage: {
    borderRadius: 999,
    display: "block",
  },
  headerTitle: {
    margin: "2px 0 2px",
    fontSize: 22,
    fontWeight: 700,
    color: "#111827",
  },
  headerSubtitle: {
    margin: 0,
    fontSize: 12,
    color: "#6b7280",
  },
  contentSection: {
    padding: "20px 24px 22px",
  },
  contentTitle: {
    margin: "0 0 10px",
    fontSize: 18,
    fontWeight: 600,
    color: "#111827",
  },
  contentText: {
    margin: "0 0 8px",
    fontSize: 14,
    lineHeight: 1.6,
    color: "#374151",
  },
  pillBase: {
    display: "inline-block",
    padding: "2px 9px",
    borderRadius: 999,
    fontWeight: 600,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },
  pillActive: {
    backgroundColor: "#dcfce7",
    color: "#166534",
  },
  pillInactive: {
    backgroundColor: "#fee2e2",
    color: "#b91c1c",
  },
  roleBadge: {
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: 999,
    backgroundColor: "#eef2ff",
    color: "#3730a3",
    fontSize: 11,
    fontWeight: 600,
  },
  domainBadge: {
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: 999,
    backgroundColor: "#e0f2fe",
    color: "#075985",
    fontSize: 11,
    fontWeight: 600,
  },
  sectionLabel: {
    margin: "10px 0 4px",
    fontSize: 12,
    fontWeight: 600,
    color: "#4b5563",
  },
  list: {
    margin: "0 0 8px 18px",
    padding: 0,
    color: "#374151",
    fontSize: 13,
  },
  listItem: {
    marginBottom: 4,
  },
  credentialsBox: {
    marginTop: 10,
    marginBottom: 8,
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    backgroundColor: "#f9fafb",
    padding: "10px 12px 10px",
  },
  credentialsTitle: {
    margin: "0 0 6px",
    fontSize: 13,
    fontWeight: 600,
    color: "#111827",
  },
  credentialsText: {
    margin: "0 0 4px",
    fontSize: 13,
    color: "#374151",
  },
  credentialsHint: {
    margin: "6px 0 0",
    fontSize: 11,
    color: "#6b7280",
  },
  code: {
    fontFamily:
      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
    backgroundColor: "#111827",
    color: "#f9fafb",
    borderRadius: 6,
    padding: "2px 6px",
    fontSize: 12,
  },
  primaryButton: {
    display: "inline-block",
    marginTop: 14,
    padding: "10px 20px",
    borderRadius: 9999,
    backgroundColor: "#4f46e5",
    color: "#ffffff",
    fontSize: 14,
    fontWeight: 600,
    textDecoration: "none",
    boxShadow: "0 12px 20px -5px rgba(79,70,229,0.35)",
  },
  smallNote: {
    marginTop: 16,
    fontSize: 12,
    lineHeight: 1.6,
    color: "#6b7280",
  },
  hr: {
    marginTop: 18,
    marginBottom: 10,
    borderColor: "#e5e7eb",
  },
  metaText: {
    margin: 0,
    fontSize: 11,
    color: "#9ca3af",
  },
  footerSection: {
    padding: "14px 24px 18px",
    borderTop: "1px solid #e5e7eb",
    backgroundColor: "#f9fafb",
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
  },
  footerText: {
    margin: "0 0 4px",
    fontSize: 11,
    color: "#6b7280",
  },
  footerTextMuted: {
    margin: 0,
    fontSize: 11,
    color: "#9ca3af",
  },
};
