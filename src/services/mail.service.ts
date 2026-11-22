import nodemailer from "nodemailer";

export interface SendContactEmailOptions {
  to: string;
  message: string;
  replyTo?: string;
  subject?: string;
  senderName?: string;
  senderEmail?: string;
  phone?: string;
  extraFields?: Record<string, any>;
  tenant?: string;
}

/**
 * Escapes HTML characters to prevent XSS / markup breaking in email clients
 */
function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Returns a configured Nodemailer Transporter
 */
export function getMailTransporter() {
  const host = process.env.SMTP_HOST || "smtp.example.com";
  const port = Number(process.env.SMTP_PORT) || 587;
  const secure = process.env.SMTP_SECURE === "true" || port === 465;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user && pass ? { user, pass } : undefined,
  });
}

/**
 * Builds a modern, clean, responsive HTML email template for the contact message
 */
export function buildContactEmailHtml(options: SendContactEmailOptions): string {
  const {
    message,
    subject = "New Contact Message",
    senderName,
    senderEmail,
    phone,
    extraFields = {},
    tenant,
  } = options;

  // Prepare sender info rows if any are provided
  const details: { label: string; value: string }[] = [];

  if (senderName) {
    details.push({ label: "Name", value: escapeHtml(senderName) });
  }
  if (senderEmail) {
    details.push({
      label: "Email",
      value: `<a href="mailto:${escapeHtml(senderEmail)}" style="color: #2563eb; text-decoration: none;">${escapeHtml(senderEmail)}</a>`,
    });
  }
  if (phone) {
    details.push({
      label: "Phone",
      value: `<a href="tel:${escapeHtml(phone)}" style="color: #2563eb; text-decoration: none;">${escapeHtml(phone)}</a>`,
    });
  }

  // Filter and append any extra fields passed in request body
  const reservedKeys = new Set(["message", "msg", "text", "name", "email", "phone", "subject"]);
  for (const [key, val] of Object.entries(extraFields)) {
    if (!reservedKeys.has(key.toLowerCase()) && val !== undefined && val !== null && val !== "") {
      const cleanKey = key.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase());
      const cleanVal = typeof val === "object" ? JSON.stringify(val) : String(val);
      details.push({ label: cleanKey, value: escapeHtml(cleanVal) });
    }
  }

  const detailsHtml =
    details.length > 0
      ? `
    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 24px; border-collapse: collapse; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
      ${details
        .map(
          (item) => `
        <tr>
          <td style="padding: 10px 16px; border-bottom: 1px solid #e2e8f0; width: 140px; font-weight: 600; font-size: 13px; color: #64748b; background-color: #f1f5f9; text-transform: uppercase; letter-spacing: 0.3px;">
            ${item.label}
          </td>
          <td style="padding: 10px 16px; border-bottom: 1px solid #e2e8f0; font-size: 14px; color: #1e293b;">
            ${item.value}
          </td>
        </tr>`,
        )
        .join("")}
    </table>`
      : "";

  const escapedMessage = escapeHtml(message);
  const now = new Date().toUTCString();
  const siteDomain = tenant ? escapeHtml(tenant) : "Landing Page";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f6f8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #1e293b;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f4f6f8; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0;">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 28px 32px; text-align: left;">
              <span style="display: inline-block; padding: 4px 10px; background: rgba(255, 255, 255, 0.12); color: #38bdf8; border-radius: 16px; font-size: 11px; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase;">
                ${siteDomain}
              </span>
              <h1 style="margin: 10px 0 0; color: #ffffff; font-size: 20px; font-weight: 700; line-height: 1.3;">
                ${escapeHtml(subject)}
              </h1>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 28px 32px;">
              ${detailsHtml}

              <!-- The Message Exactly from API -->
              <div>
                <div style="font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">
                  Message Content
                </div>
                <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-left: 4px solid #2563eb; border-radius: 8px; padding: 18px 20px; font-size: 15px; line-height: 1.7; color: #0f172a; white-space: pre-wrap; word-break: break-word;">${escapedMessage}</div>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 32px; text-align: center; font-size: 12px; color: #94a3b8;">
              <span>Sent via ${siteDomain} Contact Form</span>
              <span style="margin: 0 6px;">•</span>
              <span>${now}</span>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Builds a clean plaintext fallback for non-HTML email clients
 */
export function buildContactEmailText(options: SendContactEmailOptions): string {
  const lines: string[] = [];
  if (options.subject) lines.push(`Subject: ${options.subject}`);
  if (options.tenant) lines.push(`Site: ${options.tenant}`);
  if (options.senderName) lines.push(`From: ${options.senderName}`);
  if (options.senderEmail) lines.push(`Email: ${options.senderEmail}`);
  if (options.phone) lines.push(`Phone: ${options.phone}`);

  if (options.extraFields) {
    const reservedKeys = new Set(["message", "msg", "text", "name", "email", "phone", "subject"]);
    for (const [key, val] of Object.entries(options.extraFields)) {
      if (!reservedKeys.has(key.toLowerCase()) && val !== undefined && val !== null && val !== "") {
        lines.push(`${key}: ${typeof val === "object" ? JSON.stringify(val) : val}`);
      }
    }
  }

  lines.push("\n--- Message ---\n");
  lines.push(options.message);

  return lines.join("\n");
}

/**
 * Sends the contact email to the target recipient
 */
export async function sendContactEmail(options: SendContactEmailOptions) {
  const transporter = getMailTransporter();

  const fromName = process.env.SMTP_FROM_NAME || "Wegz";
  const fromEmail =
    process.env.SMTP_FROM_EMAIL ||
    process.env.SMTP_FROM ||
    process.env.SMTP_USER ||
    "no-reply@wegz.org";
  const from = `"${fromName}" <${fromEmail}>`;

  const html = buildContactEmailHtml(options);
  const text = buildContactEmailText(options);

  const mailOptions = {
    from,
    to: options.to,
    replyTo: options.replyTo || (options.senderEmail ? options.senderEmail : undefined),
    subject: options.subject || "New Contact Message",
    html,
    text,
  };

  return await transporter.sendMail(mailOptions);
}
