import { getStore } from '@netlify/blobs';
import { json, parseBody } from './_payments.mjs';

const store = () => getStore({ name: 'private-quotes', consistency: 'strong' });
const maxTotal = 100_000_000;

class QuoteInputError extends Error {}

function isSameOrigin(request) {
  const origin = request.headers.get('origin');
  return !origin || origin === new URL(request.url).origin;
}

// Netlify Identity validates the token; we only trust the email it returns.
async function isOwner(request) {
  const allowedEmail = process.env.QUOTES_ADMIN_EMAIL?.trim().toLowerCase();
  const authorization = request.headers.get('authorization') || '';
  if (!allowedEmail || !/^Bearer\s+\S+$/i.test(authorization)) return false;
  try {
    const response = await fetch(new URL('/.netlify/identity/user', request.url), {
      headers: { authorization, accept: 'application/json' },
      signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) return false;
    const user = await response.json();
    return String(user.email || '').trim().toLowerCase() === allowedEmail;
  } catch {
    return false;
  }
}

function validateQuote(body) {
  const customerName = String(body.customerName || '').trim();
  const customerPhone = String(body.customerPhone || '').trim();
  const customerEmail = String(body.customerEmail || '').trim();
  const notes = String(body.notes || '').trim();
  const deliveryFee = Number(body.deliveryFee || 0);
  if (customerName.length < 2 || customerName.length > 120) throw new QuoteInputError('Enter the customer name.');
  if (customerPhone.length < 5 || customerPhone.length > 40) throw new QuoteInputError('Enter a valid customer phone number.');
  if (customerEmail.length > 254 || (customerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail))) {
    throw new QuoteInputError('Enter a valid customer email address.');
  }
  if (notes.length > 1000) throw new QuoteInputError('Notes must be 1,000 characters or fewer.');
  if (!Number.isSafeInteger(deliveryFee) || deliveryFee < 0) throw new QuoteInputError('Enter a valid delivery fee.');
  if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 30) {
    throw new QuoteInputError('Add between 1 and 30 items.');
  }

  const items = body.items.map(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new QuoteInputError('Each item must be valid.');
    const name = String(item.name || '').trim();
    const quantity = Number(item.quantity);
    const unitPrice = Number(item.unitPrice);
    if (!name || name.length > 160) throw new QuoteInputError('Each item needs a name of 1 to 160 characters.');
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 99) throw new QuoteInputError('Item quantities must be between 1 and 99.');
    if (!Number.isSafeInteger(unitPrice) || unitPrice < 0) throw new QuoteInputError('Item prices must be whole UGX amounts.');
    return { name, quantity, unitPrice, lineTotal: quantity * unitPrice };
  });
  // Unit prices are VAT-inclusive; the document shows rate = price / 1.18.
  const subtotal = items.reduce((total, item) => total + item.lineTotal, 0);
  const discountType = body.discountType === 'percent' ? 'percent' : 'amount';
  const discountValue = Number(body.discountValue || 0);
  if (!Number.isFinite(discountValue) || discountValue < 0 || (discountType === 'percent' && discountValue > 100)) {
    throw new QuoteInputError('Enter a valid discount.');
  }
  const discount = discountType === 'percent' ? Math.round(subtotal * discountValue / 100) : Math.round(discountValue);
  if (discount > subtotal) throw new QuoteInputError('The discount cannot be more than the items total.');
  const total = subtotal - discount + deliveryFee;
  if (!Number.isSafeInteger(total) || total < 1 || total > maxTotal) {
    throw new QuoteInputError('The quote total must be between UGX 1 and UGX 100,000,000.');
  }

  return { customerName, customerPhone, customerEmail, notes, deliveryFee, items, subtotal, discountType, discountValue, discount, total };
}

function makeNumber(prefix) {
  const date = new Date();
  const day = date.toISOString().slice(0, 10).replaceAll('-', '');
  const suffix = crypto.randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase();
  return `SDU-${prefix}-${day}-${suffix}`;
}

export default async request => {
  if (!isSameOrigin(request)) return json({ error: 'Request origin not allowed.' }, 403);
  if (!['GET', 'POST', 'PATCH'].includes(request.method)) return json({ error: 'Method not allowed.' }, 405);
  if (!process.env.QUOTES_ADMIN_EMAIL?.trim()) return json({ error: 'Quote manager is not configured. Set QUOTES_ADMIN_EMAIL in Netlify.' }, 503);
  if (!(await isOwner(request))) return json({ error: 'You are not authorized to access quotes and invoices.' }, 403);

  try {
    const blobStore = store();
    const records = await blobStore.get('records', { type: 'json' }) || [];
    if (!Array.isArray(records)) throw new Error('Stored quote records are invalid.');

    if (request.method === 'GET') return json({ quotes: records });
    if (request.method === 'POST') {
      const body = await parseBody(request);
      const details = validateQuote(body);
      const quote = {
        ...details,
        id: crypto.randomUUID(),
        quoteNumber: makeNumber('PF'),
        status: 'quote',
        createdAt: new Date().toISOString()
      };
      await blobStore.setJSON('records', [quote, ...records]);
      return json({ quote }, 201);
    }
    if (request.method === 'PATCH') {
      const body = await parseBody(request);
      const id = String(body.id || '');
      const index = records.findIndex(record => record.id === id);
      if (index < 0) return json({ error: 'Quote not found.' }, 404);
      if (records[index].status === 'quote') {
        records[index] = {
          ...records[index],
          status: 'invoice',
          invoiceNumber: makeNumber('INV'),
          convertedAt: new Date().toISOString()
        };
        await blobStore.setJSON('records', records);
      }
      return json({ quote: records[index] });
    }
    return json({ error: 'Method not allowed.' }, 405);
  } catch (error) {
    const badRequest = error instanceof QuoteInputError || error instanceof SyntaxError || ['Invalid request.', 'Request is too large.'].includes(error.message);
    const status = badRequest ? 400 : 500;
    if (status === 500) console.error('Quote manager request failed:', error);
    return json({ error: status === 500 ? 'Unable to access quote records right now.' : error.message }, status);
  }
};
