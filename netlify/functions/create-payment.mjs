import { allowedRequest, calculateCart, json, parseBody, secretKey } from './_payments.mjs';

export default async request => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  if (!allowedRequest(request)) return json({ error: 'Request origin not allowed.' }, 403);
  const key = secretKey();
  if (!key) return json({ error: 'Flutterwave is not configured yet. Add the secret key in Netlify environment variables.' }, 503);

  try {
    const body = await parseBody(request);
    const amount = await calculateCart(request, body.cart);
    const network = body.network;
    const fullname = String(body.fullname || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const phone = String(body.phone_number || '').replace(/[\s()+-]/g, '');
    if (!['MTN', 'AIRTEL'].includes(network)) return json({ error: 'Choose MTN or Airtel Money.' }, 400);
    if (fullname.length < 2 || fullname.length > 100) return json({ error: 'Enter your full name.' }, 400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return json({ error: 'Enter a valid email address.' }, 400);
    if (!/^256\d{9}$/.test(phone)) return json({ error: 'Enter a Uganda mobile number, for example 256700123456.' }, 400);

    const txRef = `SDU-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    const gatewayResponse = await fetch('https://api.flutterwave.com/v3/charges?type=mobile_money_uganda', {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        amount,
        currency: 'UGX',
        email,
        fullname,
        phone_number: phone,
        network,
        tx_ref: txRef,
        redirect_url: `${new URL('/', request.url).href}?payment=flutterwave`
      }),
      signal: AbortSignal.timeout(15000)
    });
    const result = await gatewayResponse.json().catch(() => ({}));
    if (!gatewayResponse.ok || result.status !== 'success') {
      return json({ error: result.message || 'Flutterwave could not start the payment. Please try again or use WhatsApp checkout.' }, 502);
    }
    const authorization = result.meta?.authorization || {};
    return json({
      tx_ref: txRef,
      transaction_id: result.data?.id || null,
      message: result.message || 'Payment request created.',
      redirect: typeof authorization.redirect === 'string' ? authorization.redirect : null,
      mode: authorization.mode || null
    }, 200);
  } catch (error) {
    const status = /cart|price|catalogue|product|request|invalid|enter|choose|order/i.test(error.message) ? 400 : 502;
    return json({ error: error.message || 'Unable to start payment right now.' }, status);
  }
};

export const config = { method: 'POST' };
