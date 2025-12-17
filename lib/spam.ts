function scanForSpam(subject: string, body: string, attachmentMimeTypes: string[] = []) {
  const s = (subject || "").toLowerCase();
  const b = (body || "").toLowerCase();

  const flags: string[] = [];
  let score = 0;

  // obvious injection / malicious HTML
  if (b.includes("<script") || b.includes("javascript:") || b.includes("data:text/html")) {
    flags.push("MALICIOUS_HTML");
    score += 5;
  }

  // phishing-ish keywords
  const keywords = ["verify", "password", "urgent", "bank", "login", "account", "suspended", "gift card", "wire transfer"];
  const hitKeywords = keywords.filter(k => s.includes(k) || b.includes(k));
  if (hitKeywords.length) {
    flags.push("PHISHING_KEYWORDS");
    score += Math.min(4, hitKeywords.length);
  }

  // too many links
  const linkCount = (b.match(/https?:\/\/|www\./g) || []).length;
  if (linkCount >= 5) {
    flags.push("TOO_MANY_LINKS");
    score += 3;
  }

  // dangerous attachments
  const dangerous = [
    "application/x-msdownload",
    "application/x-dosexec",
    "application/x-msi",
    "application/vnd.microsoft.portable-executable",
  ];
  if (attachmentMimeTypes.some(m => dangerous.includes(m))) {
    flags.push("DANGEROUS_ATTACHMENT");
    score += 6;
  }

  const isSpam = score >= 5;

  return {
    isSpam,
    score,
    flags,
    reason: flags.length
      ? `Auto-filter: ${flags.join(", ")}`
      : null,
  };
}
