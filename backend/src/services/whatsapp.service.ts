import { ENV } from '../config/env';

export async function sendOrderWhatsAppMessage(
  student: {
    name: string;
    mobileNumber?: string | null;
    trackingId: string;
    orderCode?: string;
    courierName?: string;
    courierTrackingUrl?: string;
    dispatchDate?: Date;
    email?: string | null;
  },
  items: Array<{
    bookCode: string;
    bookName: string;
    requiredQuantity: number;
    dispatchedQuantity: number;
    productName?: string;
  }>
) {
  const digits = (student.mobileNumber || '').replace(/\D/g, '');
  const normalizedDigits = digits.length === 11 && digits.startsWith('0') ? digits.slice(1) : digits;
  const cleanNumber = normalizedDigits.length === 10 ? `91${normalizedDigits}` : normalizedDigits;

  if (!cleanNumber) {
    return { sent: false, reason: 'NO_MOBILE' };
  }

  const webhookUrl = ENV.WHATSAPP_WEBHOOK_URL?.trim();
  if (!ENV.WHATSAPP_ENABLED || !webhookUrl) {
    console.warn('[WHATSAPP] Not sent: WHATSAPP_ENABLED or WHATSAPP_WEBHOOK_URL is not configured.');
    return {
      sent: false,
      fallback: true,
      reason: 'NOT_CONFIGURED',
      webhookUrl,
      preview: `${student.name} (${student.trackingId}) — WhatsApp message queued for local testing`,
    };
  }

  const rowData: Array<string | number> = Array(19).fill('');
  const dispatchDate = (student.dispatchDate || new Date()).toISOString();
  const productNames = [...new Set(
    items
      .map((item) => item.productName?.trim())
      .filter((name): name is string => Boolean(name && name !== 'Product' && name !== 'Default Product'))
  )];
  const orderName = productNames.length > 0
    ? productNames.join(' & ')
    : [...new Set(items.map((item) => item.bookName))].join(' & ');

  rowData[1] = dispatchDate;
  rowData[2] = student.trackingId;
  rowData[3] = student.name;
  rowData[4] = normalizedDigits;
  rowData[11] = student.email || '';
  rowData[12] = student.courierName || '';
  rowData[13] = student.courierTrackingUrl || '';
  rowData[14] = orderName;
  rowData[16] = dispatchDate;
  rowData[17] = cleanNumber;

  const payload = {
    rowNumber: 2,
    rowData,
    type: 'EDIT',
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
    status: response.status,
    response: text.slice(0, 1000),
  };
}
