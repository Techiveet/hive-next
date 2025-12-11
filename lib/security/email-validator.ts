// lib/security/email-validator.ts
"use server";

import { z } from "zod";

// Email validation schemas
export const emailRecipientSchema = z.object({
  toIds: z.array(z.string().uuid()).min(1, "At least one recipient is required"),
  ccIds: z.array(z.string().uuid()).default([]),
  bccIds: z.array(z.string().uuid()).default([]),
});

export const emailContentSchema = z.object({
  subject: z.string()
    .min(1, "Subject is required")
    .max(200, "Subject must be less than 200 characters")
    .refine((val) => {
      // Check for suspicious patterns
      const suspiciousPatterns = [
        /(urgent|immediate|action required)/i,
        /(password|reset|verify)/i,
        /(click here|link below)/i,
        /http:\/\//i, // Non-HTTPS links
      ];
      
      return !suspiciousPatterns.some(pattern => pattern.test(val));
    }, "Subject contains suspicious content"),
  
  body: z.string()
    .min(1, "Body is required")
    .max(10000, "Body must be less than 10000 characters")
    .refine((val) => {
      // Check for excessive links
      const linkCount = (val.match(/href=["']/gi) || []).length;
      return linkCount <= 5; // Max 5 links per email
    }, "Too many links in email body")
    .refine((val) => {
      // Check for potentially malicious scripts
      const dangerousPatterns = [
        /<script[^>]*>/i,
        /javascript:/i,
        /onclick=/i,
        /onload=/i,
        /eval\(/i,
      ];
      
      return !dangerousPatterns.some(pattern => pattern.test(val));
    }, "Email body contains potentially unsafe content"),
});

export const emailAttachmentSchema = z.object({
  fileIds: z.array(z.string().uuid()).default([]),
  maxTotalSize: z.number().default(50 * 1024 * 1024), // 50MB default
  maxFiles: z.number().default(10),
}).refine((data) => data.fileIds.length <= data.maxFiles, {
  message: `Maximum ${10} attachments allowed`,
});

// Comprehensive email validation
export async function validateEmailData(data: any): Promise<{
  isValid: boolean;
  errors: string[];
  validatedData?: any;
}> {
  const errors: string[] = [];

  try {
    // Validate recipients
    const recipients = emailRecipientSchema.parse(data);
    
    // Validate content
    const content = emailContentSchema.parse(data);
    
    // Validate attachments if present
    if (data.fileIds && data.fileIds.length > 0) {
      emailAttachmentSchema.parse(data);
    }
    
    // Check for spam patterns
    const spamScore = await checkSpamPatterns(data);
    if (spamScore >= 3) {
      errors.push("Email appears to be spam. Please review your content.");
    }
    
    if (errors.length === 0) {
      return {
        isValid: true,
        errors: [],
        validatedData: { ...recipients, ...content },
      };
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      errors.push(...error.errors.map(e => e.message));
    } else {
      errors.push("Validation failed");
    }
  }
  
  return { isValid: false, errors };
}

// Spam detection
async function checkSpamPatterns(data: any): Promise<number> {
  let spamScore = 0;
  
  // Too many recipients
  if ((data.toIds?.length || 0) + (data.ccIds?.length || 0) + (data.bccIds?.length || 0) > 50) {
    spamScore += 1;
  }
  
  // All caps subject
  if ((data.subject || '').toUpperCase() === data.subject) {
    spamScore += 1;
  }
  
  // Excessive exclamation marks
  if (((data.subject || '').match(/!/g) || []).length > 3) {
    spamScore += 1;
  }
  
  // Common spam words
  if (/(win|free|prize|lottery|viagra|cialis)/i.test(data.subject || '')) {
    spamScore += 2;
  }
  
  // Short body with many links
  if ((data.body || '').length < 50 && ((data.body || '').match(/href=["']/gi) || []).length > 2) {
    spamScore += 1;
  }
  
  return spamScore;
}

// URL safety check
export async function checkUrlSafety(url: string): Promise<boolean> {
  try {
    // Use a URL safety service or check against known malicious domains
    const maliciousDomains = [
      'malicious.com',
      'phishing-site.org',
      // Add more from threat intelligence feeds
    ];
    
    const domain = new URL(url).hostname;
    return !maliciousDomains.includes(domain);
  } catch {
    return false; // Invalid URL
  }
}

// Extract URLs from HTML
export function extractUrls(html: string): string[] {
  const urls: string[] = [];
  const regex = /href=["']([^"']+)["']/gi;
  let match;
  
  while ((match = regex.exec(html)) !== null) {
    urls.push(match[1]);
  }
  
  return urls;
}