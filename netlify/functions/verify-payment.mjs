import { allowedRequest, calculateCart, json, parseBody, secretKey } from './_payments.mjs';

export default async request => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  if (!allowedRequest(request)) return json({ error: 'Request origin not allowed.' }, 403);
  const key = secretKey();
  if (!key) return json({ error: 'Flutterwave is not configured.' }, 503);

  try {
    const body = await parseBody(request);
    const txRef = String(body.tx_ref || '');
    if (!/^SDU-\d{13}-[a-f0-9]{8}$/.test(txRef)) return json({ error: 'Invalid payment reference.' }, 400);
    const expectedAmount = await calculateCart(request, body.cart);
    const response = await fetch(`https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(txRef)}`, {
      headers: { authorization: `Bearer ${key}`, accept: 'application/json' },
      signal: AbortSignal.timeout(12000)
    });
    const result = await response.json().catch(() => ({}));
    const payment = result.data || {};
    const matched = response.ok && result.status === 'success' && payment.tx_ref === txRef && payment.currency === 'UGX' && Number(payment.amount) >= expectedAmount;
    if (!matched) return json({ paid: false, message: 'Payment is still pending or could not be verified. Check the payment prompt or contact us on WhatsApp.' }, 200);
    if (payment.status !== 'successful') return json({ paid: false, message: 'Flutterwave has not confirmed this payment yet. Please wait a moment and check again.' }, 200);
    return json({ paid: true, message: 'Payment verified successfully.', amount: expectedAmount, currency: 'UGX', tx_ref: txRef }, 200);
  } catch (error) {
    return json({ error: error.message || 'Unable to verify payment right now.' }, 400);
  }
};

export const config = { method: 'POST' };
