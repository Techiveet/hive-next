// emails/backup-notification-template.tsx

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

interface BackupNotificationEmailProps {
  adminName?: string;
  filename: string;
  size: string; // Pre-formatted e.g. "12.5 MB"
  type: string; // e.g. "MANUAL_FULL", "MANUAL_DELETE"
  status: "SUCCESS" | "FAILED";
  error?: string;
  tenantName?: string;
  dashboardUrl?: string;
  count?: number;
}

export const BackupNotificationEmail = ({
  adminName,
  filename,
  size,
  type,
  status,
  error,
  tenantName,
  count = 1,
  dashboardUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
}: BackupNotificationEmailProps) => {
  const isSuccess = status === "SUCCESS";
  const formattedType = type.replace(/_/g, " ").toLowerCase();

  // Detect if this is a deletion event
  const isDelete = type.toUpperCase().includes("DELETE");

  // Dynamic Title & Intro Text
  let title = "";
  let intro = "";

  if (isDelete) {
    title = isSuccess ? "Backup Deleted" : "Deletion Failed";
    intro = isSuccess
      ? `Successfully deleted ${
          count > 1 ? `${count} backup files` : "the backup file"
        } from storage.`
      : "The system encountered an error while attempting to delete the backup(s).";
  } else {
    title = isSuccess ? "Backup Complete" : "Backup Failed";
    intro = isSuccess
      ? `A ${formattedType} backup was successfully generated and stored.`
      : `The system attempted to run a ${formattedType} backup but encountered an error.`;
  }

  // Logo Logic
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const logoURL = `${baseUrl.replace(/\/+$/, "")}/logo/logo.png`;

  return (
    <Html>
      <Head />
      <Preview>
        {title}: {filename}
      </Preview>
      <Body style={styles.main}>
        <Container style={styles.container}>
          {/* HEADER */}
          <Section style={styles.headerSection}>
            <Row>
              <Column style={{ width: 48 }}>
                <Img
                  src={logoURL}
                  alt="Logo"
                  width="40"
                  height="40"
                  style={styles.logoImage}
                />
              </Column>
              <Column>
                <Heading style={styles.headerTitle}>
                  {tenantName || "System"}
                </Heading>
                <Text style={styles.headerSubtitle}>System Notification</Text>
              </Column>
            </Row>
          </Section>

          {/* CONTENT */}
          <Section style={styles.contentSection}>
            <Heading as="h2" style={styles.contentTitle}>
              {title}
            </Heading>

            <Text style={styles.contentText}>Hi {adminName || "User"},</Text>
            <Text style={styles.contentText}>{intro}</Text>

            {/* STATUS BADGE */}
            <div style={{ margin: "16px 0" }}>
              <span
                style={{
                  ...styles.pillBase,
                  ...(isSuccess ? styles.pillActive : styles.pillInactive),
                }}
              >
                {status}
              </span>
            </div>

            {/* DETAILS BOX */}
            <Section style={styles.credentialsBox}>
              <Text style={styles.credentialsTitle}>Action Details</Text>

              <Text style={styles.credentialsText}>
                <strong>Filename:</strong>{" "}
                <span style={styles.code}>{filename}</span>
              </Text>

              {/* Only show size if it's a backup creation, not deletion */}
              {isSuccess && !isDelete && (
                <Text style={styles.credentialsText}>
                  <strong>Size:</strong> {size}
                </Text>
              )}

              <Text style={styles.credentialsText}>
                <strong>Type:</strong>{" "}
                <span style={styles.roleBadge}>{type}</span>
              </Text>

              {!isSuccess && error && (
                <Text
                  style={{
                    ...styles.credentialsText,
                    color: "#b91c1c",
                    marginTop: 8,
                  }}
                >
                  <strong>Error:</strong> {error}
                </Text>
              )}
            </Section>

            {isSuccess && (
              <Button
                href={`${dashboardUrl}/settings`}
                style={styles.primaryButton}
              >
                Manage Backups
              </Button>
            )}

            <Hr style={styles.hr} />

            <Text style={styles.metaText}>
              This is an automated notification from your Hive system.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

export default BackupNotificationEmail;

// --- STYLES ---
const styles: Record<string, React.CSSProperties> = {
  main: {
    backgroundColor: "#f3f4f6",
    padding: "24px 0",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },
  container: {
    maxWidth: "620px",
    margin: "0 auto",
    backgroundColor: "#ffffff",
    borderRadius: 18,
    border: "1px solid #e5e7eb",
    boxShadow: "0 20px 25px -5px rgba(15,23,42,0.08)",
  },
  headerSection: { padding: "20px 24px 14px", borderBottom: "1px solid #e5e7eb" },
  logoImage: { borderRadius: 999, display: "block" },
  headerTitle: { margin: "2px 0 2px", fontSize: 22, fontWeight: 700, color: "#111827" },
  headerSubtitle: { margin: 0, fontSize: 12, color: "#6b7280" },
  contentSection: { padding: "20px 24px 22px" },
  contentTitle: { margin: "0 0 10px", fontSize: 18, fontWeight: 600, color: "#111827" },
  contentText: { margin: "0 0 8px", fontSize: 14, lineHeight: 1.6, color: "#374151" },
  credentialsBox: {
    marginTop: 10,
    marginBottom: 8,
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    backgroundColor: "#f9fafb",
    padding: "12px",
  },
  credentialsTitle: { margin: "0 0 6px", fontSize: 13, fontWeight: 600, color: "#111827" },
  credentialsText: { margin: "0 0 4px", fontSize: 13, color: "#374151" },
  code: {
    fontFamily: "monospace",
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
  pillActive: { backgroundColor: "#dcfce7", color: "#166534" },
  pillInactive: { backgroundColor: "#fee2e2", color: "#b91c1c" },
  roleBadge: {
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: 999,
    backgroundColor: "#eef2ff",
    color: "#3730a3",
    fontSize: 11,
    fontWeight: 600,
  },
  hr: { marginTop: 18, marginBottom: 10, borderColor: "#e5e7eb" },
  metaText: { margin: 0, fontSize: 11, color: "#9ca3af" },
};
