import nodemailer from 'nodemailer';
import { ENV } from '../config/env';

const hasSmtpConfig = Boolean(ENV.SMTP_HOST && ENV.SMTP_USER && ENV.SMTP_PASS);

const transporter = hasSmtpConfig
  ? nodemailer.createTransport({
      host: ENV.SMTP_HOST,
      port: ENV.SMTP_PORT,
      secure: ENV.SMTP_PORT === 465,
      auth: {
        user: ENV.SMTP_USER,
        pass: ENV.SMTP_PASS,
      },
    })
  : null;

export async function verifyEmailTransport() {
  if (!ENV.EMAIL_ENABLED) {
    console.info('[EMAIL] Sending is disabled (EMAIL_ENABLED is not true).');
    return;
  }

  if (!transporter) {
    const missing = [
      !ENV.SMTP_HOST && 'SMTP_HOST',
      !ENV.SMTP_USER && 'SMTP_USER',
      !ENV.SMTP_PASS && 'SMTP_PASS',
    ].filter(Boolean);
    console.error(`[EMAIL] SMTP is not configured. Missing: ${missing.join(', ')}.`);
    return;
  }

  try {
    await transporter.verify();
    console.info(`[EMAIL] SMTP connection verified for ${ENV.SMTP_USER}.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[EMAIL] SMTP connection check failed: ${message}`);
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
    console.warn('[EMAIL] Not sent: EMAIL_ENABLED or SMTP configuration is missing.');
    return {
      sent: false,
      fallback: true,
      reason: 'NOT_CONFIGURED',
    };
  }

  if (!ENV.SMTP_FROM) {
    console.error('[EMAIL] Not sent: SMTP_FROM and SMTP_USER are both missing.');
    return { sent: false, reason: 'SENDER_NOT_CONFIGURED' };
  }

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
    from: ENV.SMTP_FROM,
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
    text: `Hello ${student.name},\n\nWe have received your order ${student.orderCode || student.trackingId} and it is being processed. We will notify you when it has been dispatched.\nTracking ID: ${student.trackingId}\n\nItems:\n${items
      .map(
        (item) => `${item.bookCode} - ${item.bookName} (${item.requiredQuantity} required, ${item.dispatchedQuantity} dispatched)`
      )
      .join('\n')}`,
  });

  return {
    sent: true,
    messageId: info.messageId,
    fallback: false,
  };
}
