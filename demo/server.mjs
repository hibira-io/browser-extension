// Local demo: a made-up shop admin to work on, and a stand-in for the Hibira
// extension API that plays a fixed script (no model, no account). Used for
// development and store screenshots, never against production.
//
//   node demo/server.mjs            # http://localhost:5174
import { createServer } from 'node:http';
import { S, pickLang } from './strings.mjs';

const PORT = Number(process.env.PORT ?? 5174);
const orders = [
  { id: 1042, row: 0, total: '$36.00', shipped: false, carrier: '', tracking: '' },
  { id: 1043, row: 1, total: '$28.00', shipped: false, carrier: '', tracking: '' },
  { id: 1044, row: 2, total: '$84.00', shipped: false, carrier: '', tracking: '' },
];

const css = `body{margin:0;font:15px/1.5 system-ui,sans-serif;color:#1f2430;background:#f5f6f8}
header{background:#24324a;color:#fff;padding:14px 28px;font-weight:600;display:flex;gap:24px;align-items:center}
header nav a{color:#c9d3e6;text-decoration:none;font-weight:400}main{max-width:820px;margin:28px auto;padding:0 20px}
h1{font-size:22px;margin:0 0 16px}table{width:100%;border-collapse:collapse;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 1px 3px #0001}
th,td{text-align:left;padding:12px 14px;border-bottom:1px solid #eceef2}th{font-size:13px;color:#667;background:#fafbfc}
a{color:#2457c5}.card{background:#fff;border-radius:10px;padding:20px 22px;box-shadow:0 1px 3px #0001;margin-bottom:16px}
label{display:block;font-size:13px;color:#556;margin:12px 0 4px}input,select{font:inherit;padding:8px 10px;border:1px solid #cfd5df;border-radius:8px;width:100%;max-width:340px;box-sizing:border-box}
button{font:inherit;margin-top:16px;padding:9px 18px;border:0;border-radius:8px;background:#2457c5;color:#fff;cursor:pointer}
.badge{display:inline-block;padding:2px 10px;border-radius:99px;font-size:12px;background:#fff3d6;color:#7a5600}.badge.done{background:#dcf5e6;color:#1e6b40}
.ok{background:#dcf5e6;color:#1e6b40;padding:10px 14px;border-radius:8px;margin-bottom:16px}`;

function layout(L, lang, title, body) {
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><title>${title} · Northwind Supply</title><style>${css}</style></head>
<body><header>Northwind Supply<nav>${L.nav.map((n) => `<a href="/orders">${n}</a>`).join(' ')}</nav></header><main>${body}</main></body></html>`;
}

const badge = (L, o) => `<span class="badge ${o.shipped ? 'done' : ''}">${o.shipped ? L.shipped : L.waiting}</span>`;

function ordersPage(lang) {
  const L = S[lang];
  const rows = orders.map((o) => `<tr><td><a href="/orders/${o.id}">#${o.id}</a></td><td>${L.rows[o.row][0]}</td><td>${L.rows[o.row][1]}</td><td>${o.total}</td><td>${badge(L, o)}</td></tr>`).join('');
  return layout(L, lang, L.orders, `<h1>${L.orders}</h1><table><thead><tr>${L.cols.map((c) => `<th>${c}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>`);
}

function orderPage(lang, o, saved) {
  const L = S[lang];
  const opt = (v, t) => `<option value="${v}" ${o.carrier === v ? 'selected' : ''}>${t}</option>`;
  return layout(L, lang, `${L.order} #${o.id}`, `${saved ? `<div class="ok">${L.saved}</div>` : ''}<h1>${L.order} #${o.id} ${badge(L, o)}</h1>
<div class="card"><strong>${L.rows[o.row][0]}</strong><p>${L.rows[o.row][1]} · ${o.total}</p></div>
<form class="card" method="post" action="/orders/${o.id}"><h2 style="font-size:17px;margin:0">${L.shipment}</h2>
<label for="carrier">${L.carrier}</label><select id="carrier" name="carrier">${opt('', L.choose)}${opt('dhl', 'DHL')}${opt('ups', 'UPS')}${opt('fedex', 'FedEx')}</select>
<label for="tracking">${L.tracking}</label><input id="tracking" name="tracking" value="${o.tracking}">
<button type="submit">${L.save}</button></form><p><a href="/orders">${L.back}</a></p>`);
}

// The scripted stand-in for the model, speaking the Secretary API's turn
// format: one fixed chore, driven by the refs in the latest page read.
function scriptedTurn(req) {
  const L = S[pickLang(req.locale)];
  const step = req.messages.filter((m) => m.role === 'assistant').length;
  const lastRead = [...req.messages].reverse().flatMap((m) => m.content).find((b) => b.type === 'tool_result' && String(b.content).startsWith('Page:'));
  const ref = (label) => lastRead?.content.split('\n').find((l) => l.includes(label))?.match(/\[(e\d+)\]/)?.[1];
  const use = (name, input) => ({ type: 'tool_use', id: `t${step}_${name}`, name, input });
  const plan = [
    () => [{ type: 'text', text: L.opening }, use('read_page', {})],
    () => [use('click', { ref: ref('"#1042"') })],
    () => [use('read_page', {})],
    () => [use('select', { ref: ref(`"${L.carrier}"`), value: 'DHL' }), use('type', { ref: ref(`"${L.tracking}"`), text: 'JD014600' })],
    () => [{ type: 'text', text: L.filled }, use('click', { ref: ref(`"${L.save}"`) })],
  ];
  const content = step < plan.length ? plan[step]() : [{ type: 'text', text: L.done }];
  return {
    message: { role: 'assistant', content },
    stop_reason: content.some((b) => b.type === 'tool_use') ? 'tool_use' : 'end_turn',
    task_id: 'task_demo',
    units: 1,
    tasks: { used: 3, included: 30, extra: 0 },
  };
}

function readBody(req) {
  return new Promise((resolve) => {
    let b = '';
    req.on('data', (c) => (b += c));
    req.on('end', () => resolve(b));
  });
}

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'GET, POST, DELETE' };
  if (req.method === 'OPTIONS') return res.writeHead(204, cors).end();
  if (url.pathname === '/secretary/v1/me') {
    const me = { workspace: 'Personal', auto_mode: false, branding: true, user: 'demo@example.com', enabled: true, tasks: { used: 3, included: 30, extra: 0 } };
    return res.writeHead(200, { ...cors, 'Content-Type': 'application/json' }).end(JSON.stringify(me));
  }
  if (url.pathname === '/secretary/v1/turn' && req.method === 'POST') {
    const body = JSON.parse(await readBody(req));
    return res.writeHead(200, { ...cors, 'Content-Type': 'application/json' }).end(JSON.stringify(scriptedTurn(body)));
  }
  // Sign in with Hibira, as hibira.io answers a first-party client.
  if (url.pathname === '/oauth/authorize') {
    const back = new URL(url.searchParams.get('redirect_uri'));
    back.search = new URLSearchParams({ code: 'demo_code', state: url.searchParams.get('state') ?? '' }).toString();
    return res.writeHead(302, { Location: back.toString() }).end();
  }
  if (url.pathname === '/oauth/token' && req.method === 'POST') {
    return res.writeHead(200, { ...cors, 'Content-Type': 'application/json' }).end(JSON.stringify({ access_token: 'si_demo', token_type: 'Bearer', scope: 'email', expires_in: 300 }));
  }
  if (url.pathname === '/secretary/v1/extension/session' && req.method === 'POST') {
    const session = { token: 'sst_demo', email: 'demo@example.com', expires_at: new Date(Date.now() + 30 * 864e5).toISOString() };
    return res.writeHead(200, { ...cors, 'Content-Type': 'application/json' }).end(JSON.stringify(session));
  }
  const m = url.pathname.match(/^\/orders\/(\d+)$/);
  const o = m && orders.find((x) => x.id === Number(m[1]));
  if (o && req.method === 'POST') {
    const f = new URLSearchParams(await readBody(req));
    o.carrier = f.get('carrier') ?? '';
    o.tracking = f.get('tracking') ?? '';
    if (o.carrier && o.tracking) o.shipped = true;
    return res.writeHead(303, { Location: `/orders/${o.id}?saved=1` }).end();
  }
  const lang = pickLang(url.searchParams.get('lang') ?? req.headers['accept-language']);
  const html = o ? orderPage(lang, o, url.searchParams.has('saved')) : ordersPage(lang);
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(html);
}).listen(PORT, () => console.log(`demo on http://localhost:${PORT}`));
