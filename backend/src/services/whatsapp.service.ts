import { ENV } from '../config/env';

export async function sendOrderWhatsAppMessage(student: {
  name: string;
  mobileNumber?: string | null;
  trackingId: string;
  orderCode?: string;
}, items: Array<{ bookCode: string; bookName: string; requiredQuantity: number; dispatchedQuantity: number }>) {
  const cleanNumber = (student.mobileNumber || '').replace(/\D/g, '');

  if (!cleanNumber) {
    return { sent: false, reason: 'NO_MOBILE' };
  }

  const webhookUrl = ENV.WHATSAPP_WEBHOOK_URL?.trim();
  if (!ENV.WHATSAPP_ENABLED || !webhookUrl) {
    console.log(`[WHATSAPP] Dev fallback: order update for ${cleanNumber} would be sent via WhatsApp webhook.`);
    return {
      sent: true,
      fallback: true,
      webhookUrl,
      preview: `${student.name} (${student.trackingId}) — WhatsApp message queued for local testing`,
    };
  }

  const messageText = `Hello ${student.name}, your order ${student.orderCode || student.trackingId} has been dispatched. Tracking ID: ${student.trackingId}. Items:\n${items
    .map((item) => `${item.bookCode} - ${item.bookName} (${item.dispatchedQuantity}/${item.requiredQuantity})`)
    .join('\n')}`;

  const payload = {
    to: cleanNumber,
    text: messageText,
    template: 'order_dispatch',
    trackingId: student.trackingId,
    orderCode: student.orderCode || student.trackingId,
  };

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`WhatsApp webhook failed: ${response.status} ${text}`);
  }

  return {
    sent: true,
    fallback: false,
    webhookUrl,
    status: response.status,
    response: text,
  };
}
