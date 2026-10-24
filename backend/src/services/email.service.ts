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
    console.log(`[EMAIL] Dev fallback: order email for ${student.email} would be sent.`);
    return {
      sent: true,
      fallback: true,
      messageId: `dev-fallback-${Date.now()}`,
      preview: `${student.name} (${student.trackingId}) — email queued for local testing`,
    };
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
    subject: `Your order ${student.orderCode || student.trackingId} is ready for dispatch`,
    html: `
      <div style="font-family:Arial,sans-serif; color:#111827; line-height:1.6;">
        <h2 style="margin-bottom:12px;">Hello ${student.name},</h2>
        <p>Your books are ready to be dispatched.</p>
        <p><strong>Tracking ID:</strong> ${student.trackingId}</p>
        <p><strong>Order Code:</strong> ${student.orderCode || 'N/A'}</p>
        <table style="border-collapse:collapse; width:100%; margin-top:16px;">
          <thead>
            <tr>
              <th style="padding:8px 12px; border:1px solid #e5e7eb; background:#f3f4f6; text-align:left;">Book Code</th>
              <th style="padding:8px 12px; border:1px solid #e5e7eb; background:#f3f4f6; text-align:left;">Book Name</th>
              <th style="padding:8px 12px; border:1px solid #e5e7eb; background:#f3f4f6; text-align:center;">Required</th>
              <th style="padding:8px 12px; border:1px solid #e5e7eb; background:#f3f4f6; text-align:center;">Dispatched</th>
            </tr>
          </thead>
          <tbody>${itemRows}</tbody>
        </table>
        <p style="margin-top:18px;">Thank you.</p>
      </div>
    `,
    text: `Hello ${student.name},\n\nYour order ${student.orderCode || student.trackingId} is ready for dispatch.\nTracking ID: ${student.trackingId}\n\nItems:\n${items
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
