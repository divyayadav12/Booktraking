import nodemailer from 'nodemailer';
import { ENV } from '../config/env';

// ─── Resend (HTTP API) transport ─────────────────────────────────────────────
// Used when RESEND_API_KEY is set — works on Render free plan (no SMTP block)
function createResendTransport() {
  if (!ENV.RESEND_API_KEY) return null;
  return nodemailer.createTransport({
    host: 'smtp.resend.com',
    port: 465,
    secure: true,
    auth: {
      user: 'resend',
      pass: ENV.RESEND_API_KEY,
    },
  });
}

// ─── Gmail SMTP transport ─────────────────────────────────────────────────────
// Used as fallback when SMTP_HOST/USER/PASS are set
const hasSmtpConfig = Boolean(ENV.SMTP_HOST && ENV.SMTP_USER && ENV.SMTP_PASS);
function createSmtpTransport() {
  if (!hasSmtpConfig) return null;
  return nodemailer.createTransport({
    host: ENV.SMTP_HOST,
    port: ENV.SMTP_PORT,
    secure: ENV.SMTP_PORT === 465,
    auth: {
      user: ENV.SMTP_USER,
      pass: ENV.SMTP_PASS,
    },
  });
}

// Pick the best available transport: Resend first, then SMTP
const transporter = createResendTransport() || createSmtpTransport();

export async function verifyEmailTransport() {
  if (!ENV.EMAIL_ENABLED) {
    console.info('[EMAIL] Sending is disabled (EMAIL_ENABLED is not true).');
    return;
  }

  if (!transporter) {
    console.error('[EMAIL] No transport configured. Set RESEND_API_KEY or SMTP_HOST+SMTP_USER+SMTP_PASS.');
    return;
  }

  const mode = ENV.RESEND_API_KEY ? 'Resend API' : `SMTP (${ENV.SMTP_USER})`;
  try {
    await transporter.verify();
    console.info(`[EMAIL] Transport verified via ${mode}.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[EMAIL] Transport check failed (${mode}): ${message}`);
  }
}

export async function sendOrderEmail(
  student: {
    name: string;
    email: string | null;
    trackingId: string;
    orderCode?: string;
  },
  items: Array<{ bookCode: string; bookName: string; requiredQuantity: number; dispatchedQuantity: number }>
) {
  if (!student.email) {
    return { sent: false, reason: 'NO_EMAIL' };
  }

  if (!ENV.EMAIL_ENABLED || !transporter) {
    console.warn('[EMAIL] Not sent: EMAIL_ENABLED or transport configuration is missing.');
    return { sent: false, fallback: true, reason: 'NOT_CONFIGURED' };
  }

  const fromAddress = ENV.SMTP_FROM || ENV.SMTP_USER || 'noreply@fastdispatch.in';

  const itemRows = items
    .map(
      (item) => `
        <tr>
          <td style="padding:8px 12px; border:1px solid #e5e7eb;">${item.bookCode}</td>
          <td style="padding:8px 12px; border:1px solid #e5e7eb;">${item.bookName}</td>
          <td style="padding:8px 12px; border:1px solid #e5e7eb; text-align:center;">${item.requiredQuantity}</td>
          <td style="padding:8px 12px; border:1px solid #e5e7eb; text-align:center;">${item.dispatchedQuantity}</td>
        </tr>`
    )
    .join('');

  const info = await transporter.sendMail({
    from: fromAddress,
    to: student.email,
    subject: `We received your order ${student.orderCode || student.trackingId}`,
    html: `
      <div style="font-family:Arial,sans-serif; color:#111827; line-height:1.6;">
        <h2 style="margin-bottom:12px;">Hello ${student.name},</h2>
        <p>We have received your order and it is being processed. We will notify you when it has been dispatched.</p>
        <p><strong>Tracking ID:</strong> ${student.trackingId}</p>
        <p><strong>Order Code:</strong> ${student.orderCode || 'N/A'}</p>
        <table style="border-collapse:collapse; width:100%; margin-top:16px;">
          <thead>
            <tr>
              <th style="padding:8px 12px; border:1px solid #e5e7eb; background:#f3f4f6; text-align:left;">Book Code</th>
              <th style="padding:8px 12px; border:1px solid #e5e7eb; background:#f3f4f6; text-align:left;">Book Name</th>
              <th style="padding:8px 12px; border:1px solid #e5e7eb; background:#f3f4f6; text-align:center;">Required</th>
              <th style="padding:8px 12px; border:1px solid #e5e7eb; background:#f3f4f6; text-align:center;">Dispatched so far</th>
            </tr>
          </thead>
          <tbody>${itemRows}</tbody>
        </table>
        <p style="margin-top:18px;">Thank you.</p>
      </div>
    `,
    text: `Hello ${student.name},\n\nWe have received your order ${student.orderCode || student.trackingId} and it is being processed.\nTracking ID: ${student.trackingId}\n\nItems:\n${items
      .map((item) => `${item.bookCode} - ${item.bookName} (${item.requiredQuantity} required, ${item.dispatchedQuantity} dispatched)`)
      .join('\n')}`,
  });

  return { sent: true, messageId: info.messageId, fallback: false };
}
