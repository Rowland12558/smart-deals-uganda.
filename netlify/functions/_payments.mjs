export function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });
}

export function allowedRequest(request) {
  const origin = request.headers.get('origin');
  return Boolean(origin) && origin === new URL(request.url).origin;
}

export async function parseBody(request) {
  const length = Number(request.headers.get('content-length') || 0);
  if (length > 12000) throw new Error('Request is too large.');
  const body = await request.json();
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Invalid request.');
  return body;
}

export async function calculateCart(request, rawCart) {
  if (!Array.isArray(rawCart) || rawCart.length < 1 || rawCart.length > 30) throw new Error('Your cart is empty or too large.');
  const catalogueUrl = new URL('/data/products.json', request.url);
  const response = await fetch(catalogueUrl, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error('The product catalogue is temporarily unavailable.');
  const catalogue = await response.json();
  if (!Array.isArray(catalogue.products)) throw new Error('The product catalogue is invalid.');
  const products = new Map(catalogue.products.filter(p => p && typeof p.id === 'string').map(p => [p.id, p]));
  const seen = new Set();
  let total = 0;
  for (const line of rawCart) {
    if (!line || typeof line.id !== 'string' || !Number.isInteger(line.qty) || line.qty < 1 || line.qty > 99 || seen.has(line.id)) {
      throw new Error('Your cart contains an invalid item. Please refresh and try again.');
    }
    seen.add(line.id);
    const product = products.get(line.id);
    const price = Number(product?.price);
    if (!product || !Number.isSafeInteger(price) || price <= 0) throw new Error('A cart item has no valid price. Please contact the store.');
    total += price * line.qty;
    if (!Number.isSafeInteger(total) || total > 100000000) throw new Error('The order total is outside the supported range.');
  }
  return total;
}

export function secretKey() {
  return process.env.FLW_SECRET_KEY || process.env.FLUTTERWAVE_SECRET_KEY || '';
}
