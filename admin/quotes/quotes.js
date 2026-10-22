const $ = selector => document.querySelector(selector);
const authPanel = $('#authPanel');
const manager = $('#manager');
const accessError = $('#accessError');
const itemsHost = $('#quoteItems');
const currency = value => new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', maximumFractionDigits: 0 }).format(value);
let identityUser;
let quotes = [];

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function showError(message) {
  accessError.textContent = message;
  accessError.classList.remove('hidden');
}

function showFormError(message) {
  const error = $('#formError');
  error.textContent = message;
  error.classList.remove('hidden');
}

async function api(path = '', options = {}) {
  const token = identityUser?.token?.access_token;
  if (!token) throw new Error('Your sign-in session has expired. Sign in again to continue.');
  const response = await fetch(`/.netlify/functions/quotes${path}`, {
    ...options,
    headers: {
      authorization: `Bearer ${token}`,
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...options.headers
    },
    cache: 'no-store'
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'Could not access quote records.');
  return result;
}

function addItem(item = {}) {
  if (itemsHost.children.length >= 30) return;
  const row = document.createElement('div');
  row.className = 'quote-item';
  row.innerHTML = `
    <label>Item<input name="itemName" maxlength="160" required value="${escapeHtml(item.name || '')}" placeholder="Product name"></label>
    <label>Qty<input name="quantity" type="number" min="1" max="99" step="1" value="${item.quantity || 1}" required></label>
    <label>Unit price<input name="unitPrice" type="number" min="0" step="1" value="${item.unitPrice || ''}" inputmode="numeric" required placeholder="UGX"></label>
    <button class="remove-item" type="button" aria-label="Remove item">×</button>`;
  row.addEventListener('input', updateTotal);
  row.querySelector('.remove-item').addEventListener('click', () => {
    row.remove();
    if (!itemsHost.children.length) addItem();
    updateTotal();
  });
  itemsHost.append(row);
}

function computeTotals() {
  const itemTotal = [...itemsHost.querySelectorAll('.quote-item')].reduce((sum, row) => {
    return sum + (Number(row.querySelector('[name="quantity"]').value) || 0) * (Number(row.querySelector('[name="unitPrice"]').value) || 0);
  }, 0);
  const form = $('#quoteForm').elements;
  const delivery = Number(form.deliveryFee.value) || 0;
  const value = Number(form.discountValue.value) || 0;
  const discount = form.discountType.value === 'percent' ? Math.round(itemTotal * value / 100) : Math.round(value);
  return itemTotal - discount + delivery;
}

function updateTotal() {
  $('#formTotal').textContent = currency(computeTotals());
}

function renderQuotes() {
  const host = $('#recordsList');
  if (!quotes.length) {
    host.innerHTML = '<div class="records-empty">No documents yet. Create a quote to get started.</div>';
    return;
  }
  host.innerHTML = quotes.map(quote => {
    const number = quote.status === 'invoice' ? quote.invoiceNumber : quote.quoteNumber;
    const date = new Date(quote.createdAt).toLocaleDateString('en-UG', { year: 'numeric', month: 'short', day: 'numeric' });
    return `<article class="record-card">
      <div class="record-top"><div><h3>${escapeHtml(number)}</h3><div class="record-meta">${escapeHtml(quote.customerName)} · ${escapeHtml(quote.customerPhone)}<br>${escapeHtml(date)}</div></div><span class="record-status ${quote.status === 'invoice' ? 'invoice' : ''}">${quote.status === 'invoice' ? 'Invoice' : 'Proforma'}</span></div>
      <p class="record-total">${currency(quote.total)}</p>
      <div class="record-actions"><button class="button button-outline" data-action="download" data-id="${escapeHtml(quote.id)}" type="button">Download PDF / print</button>
      ${quote.status === 'quote' ? `<button class="button button-orange" data-action="convert" data-id="${escapeHtml(quote.id)}" type="button">Convert to invoice</button>` : ''}</div>
    </article>`;
  }).join('');
}

async function loadQuotes() {
  const result = await api();
  quotes = result.quotes;
  renderQuotes();
}

function printDocument(quote) {
  const isInvoice = quote.status === 'invoice';
  const number = isInvoice ? quote.invoiceNumber : quote.quoteNumber;
  const rows = quote.items.map(item => `<tr><td>${escapeHtml(item.name)}</td><td class="n">${item.quantity}</td><td class="n">${currency(item.unitPrice)}</td><td class="n">${currency(item.unitPrice * item.quantity)}</td></tr>`).join('');
  const discount = quote.discount || 0;
  const discountLabel = quote.discountType === 'percent' && quote.discountValue ? `Discount (${quote.discountValue}%)` : 'Discount';
  const origin = location.origin;
  const printWindow = window.open('', '_blank');
  if (!printWindow) throw new Error('Allow pop-ups for this site to download or print the document.');
  printWindow.document.write(`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(number)}</title><style>
    *{box-sizing:border-box}body{font:13px Arial,sans-serif;color:#17212b;margin:0 auto;max-width:800px;padding:36px 28px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    header{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;border-bottom:3px solid #149fd0;padding-bottom:18px}
    .brand{display:flex;gap:14px;align-items:center}.brand img{width:78px;height:78px;object-fit:contain}.brand h1{margin:0;color:#0878ad;font-size:24px}.brand .tag{color:#f36b21;font-weight:bold;font-size:12px;margin:2px 0 6px}.contact{font-size:12px;line-height:1.55;color:#40505b}
    .doc{text-align:right}.doc .type{display:inline-block;background:#f36b21;color:#fff;font-weight:bold;letter-spacing:1px;font-size:17px;padding:8px 14px;border-radius:6px}.doc.invoice .type{background:#0878ad}.doc p{margin:8px 0 0;line-height:1.6}
    .bill{margin:22px 0;padding:14px 16px;background:#f6fafc;border-left:4px solid #149fd0;border-radius:4px}.bill small{color:#687783;text-transform:uppercase;letter-spacing:1px;font-size:10px}
    table{width:100%;border-collapse:collapse}th{background:#149fd0;color:#fff;text-align:left;padding:10px 8px;font-size:12px}td{padding:10px 8px;border-bottom:1px solid #e6edf1}.n{text-align:right}th.n{text-align:right}
    .totals{margin:16px 0 0 auto;width:320px}.totals div{display:flex;justify-content:space-between;padding:6px 8px}.totals .grand{background:#17212b;color:#fff;font-weight:bold;font-size:16px;margin-top:6px;border-radius:5px}
    .block{margin-top:24px;padding:14px 16px;border:1px solid #e6edf1;border-radius:6px;break-inside:avoid}.block h3{margin:0 0 8px;color:#0878ad;font-size:13px;text-transform:uppercase;letter-spacing:.8px}.block p{margin:4px 0;line-height:1.5}.notes{white-space:pre-wrap}
    footer{margin-top:30px;padding:18px;text-align:center;background:linear-gradient(120deg,#149fd0,#0878ad);color:#fff;border-radius:8px;break-inside:avoid}footer strong{display:block;font-size:17px;margin-bottom:5px}footer span{font-size:12px;opacity:.95}
    @media print{body{padding:0}@page{margin:14mm}}</style></head><body>
    <header>
      <div class="brand"><img src="${origin}/assets/smart-deals-logo.png" alt=""><div><h1>Smart Deals Uganda</h1><div class="tag">Smart Shopping. Better Deals.</div><div class="contact">Tel: +256 700 321 960<br>WhatsApp: +256 704 292 913<br>smartdealsuganda.netlify.app</div></div></div>
      <div class="doc ${isInvoice ? 'invoice' : ''}"><span class="type">${isInvoice ? 'INVOICE' : 'PROFORMA INVOICE'}</span><p><strong>No: ${escapeHtml(number)}</strong><br>Date: ${new Date(isInvoice && quote.convertedAt ? quote.convertedAt : quote.createdAt).toLocaleDateString('en-UG', { year: 'numeric', month: 'long', day: 'numeric' })}${isInvoice ? `<br>Ref. proforma: ${escapeHtml(quote.quoteNumber)}` : ''}</p></div>
    </header>
    <div class="bill"><small>Billed to</small><br><strong>${escapeHtml(quote.customerName)}</strong><br>${escapeHtml(quote.customerPhone)}${quote.customerEmail ? `<br>${escapeHtml(quote.customerEmail)}` : ''}</div>
    <table><thead><tr><th>Product name</th><th class="n">Qty</th><th class="n">Rate</th><th class="n">Amount</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="totals">
      <div><span>Subtotal</span><span>${currency(quote.subtotal)}</span></div>
      ${discount ? `<div><span>${discountLabel}</span><span>- ${currency(discount)}</span></div>` : ''}
      ${quote.deliveryFee ? `<div><span>Delivery</span><span>${currency(quote.deliveryFee)}</span></div>` : ''}
      <div class="grand"><span>Total (UGX)</span><span>${currency(quote.total)}</span></div>
    </div>
    <div class="block"><h3>Payment terms</h3><p><strong>Mobile money:</strong> 0700321960 / 0767776333 / 0794152296</p><p><strong>Account name:</strong> Muhwezi Rowland (all numbers)</p></div>
    <div class="block"><h3>Terms</h3><p>Payment is only made to the provided accounts above.</p>${isInvoice ? '' : '<p>This proforma invoice is a price quotation; prices and availability are confirmed when you approve it.</p>'}</div>
    ${quote.notes ? `<div class="block notes"><h3>Notes</h3>${escapeHtml(quote.notes)}</div>` : ''}
    <footer><strong>Thank you for shopping smart with us! 💙🧡</strong><span>Great deals, honest service, delivered to your door. We look forward to serving you again.</span></footer>
    <script>window.addEventListener('load',()=>window.print())<\/script></body></html>`);
  printWindow.document.close();
}

$('#loginButton').addEventListener('click', () => window.netlifyIdentity?.open('login'));
$('#logoutButton').addEventListener('click', () => window.netlifyIdentity?.logout());
$('#addItemButton').addEventListener('click', () => addItem());
$('#refreshButton').addEventListener('click', async () => {
  try { await loadQuotes(); } catch (error) { showError(error.message); }
});
$('#quoteForm').elements.deliveryFee.addEventListener('input', updateTotal);
$('#quoteForm').elements.discountValue.addEventListener('input', updateTotal);
$('#quoteForm').elements.discountType.addEventListener('change', updateTotal);
itemsHost.addEventListener('input', updateTotal);

$('#quoteForm').addEventListener('submit', async event => {
  event.preventDefault();
  $('#formError').classList.add('hidden');
  const form = event.currentTarget;
  const items = [...itemsHost.querySelectorAll('.quote-item')].map(row => ({
    name: row.querySelector('[name="itemName"]').value.trim(),
    quantity: Number(row.querySelector('[name="quantity"]').value),
    unitPrice: Number(row.querySelector('[name="unitPrice"]').value)
  }));
  const body = {
    customerName: form.elements.customerName.value.trim(),
    customerPhone: form.elements.customerPhone.value.trim(),
    customerEmail: form.elements.customerEmail.value.trim(),
    deliveryFee: Number(form.elements.deliveryFee.value || 0),
    discountType: form.elements.discountType.value,
    discountValue: Number(form.elements.discountValue.value || 0),
    notes: form.elements.notes.value.trim(),
    items
  };
  const button = $('#saveQuoteButton');
  button.disabled = true;
  try {
    const result = await api('', { method: 'POST', body: JSON.stringify(body) });
    quotes.unshift(result.quote);
    renderQuotes();
    form.reset();
    itemsHost.replaceChildren();
    addItem();
    updateTotal();
  } catch (error) {
    showFormError(error.message);
  } finally {
    button.disabled = false;
  }
});

$('#recordsList').addEventListener('click', async event => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const quote = quotes.find(record => record.id === button.dataset.id);
  if (!quote) return;
  button.disabled = true;
  try {
    if (button.dataset.action === 'download') {
      printDocument(quote);
      return;
    }
    if (!window.confirm(`Convert ${quote.quoteNumber} to an invoice?`)) return;
    const result = await api('', { method: 'PATCH', body: JSON.stringify({ id: quote.id }) });
    quotes = quotes.map(record => record.id === result.quote.id ? result.quote : record);
    renderQuotes();
  } catch (error) {
    showError(error.message);
  } finally {
    button.disabled = false;
  }
});

async function signedIn(user) {
  identityUser = user;
  if (!user) {
    manager.classList.add('hidden');
    $('#logoutButton').classList.add('hidden');
    authPanel.classList.remove('hidden');
    $('#authMessage').textContent = 'Sign in with the owner Netlify Identity account to continue.';
    return;
  }
  authPanel.classList.add('hidden');
  accessError.classList.add('hidden');
  $('#logoutButton').classList.remove('hidden');
  try {
    await loadQuotes();
    manager.classList.remove('hidden');
  } catch (error) {
    manager.classList.add('hidden');
    showError(error.message);
  }
}

addItem();
updateTotal();
if (window.netlifyIdentity) {
  window.netlifyIdentity.on('init', signedIn);
  window.netlifyIdentity.on('login', user => {
    window.netlifyIdentity.close();
    signedIn(user);
  });
  window.netlifyIdentity.on('logout', () => signedIn(null));
} else {
  $('#authMessage').textContent = 'Sign-in is unavailable. Enable Netlify Identity for this site and try again.';
  $('#loginButton').disabled = true;
}
