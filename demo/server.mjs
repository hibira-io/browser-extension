// Local demo: a made-up shop admin to work on, and a stand-in for the Hibira
// extension API that plays a fixed script (no model, no account). Used for
// development and store screenshots, never against production.
//
//   node demo/server.mjs            # http://localhost:5174
import { createServer } from 'node:http';

const PORT = Number(process.env.PORT ?? 5174);
const orders = [
  { id: 1042, customer: 'Mika Tanaka', items: 'Ceramic mug ×2', total: '$36.00', status: 'Awaiting shipment', carrier: '', tracking: '' },
  { id: 1043, customer: 'Leo Martins', items: 'Linen apron', total: '$28.00', status: 'Awaiting shipment', carrier: '', tracking: '' },
  { id: 1044, customer: 'Ana Ruiz', items: 'Teapot, cups ×4', total: '$84.00', status: 'Awaiting shipment', carrier: '', tracking: '' },
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

function layout(title, body) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title} · Northwind Supply</title><style>${css}</style></head>
<body><header>Northwind Supply<nav><a href="/orders">Orders</a> <a href="/orders">Products</a> <a href="/orders">Customers</a></nav></header><main>${body}</main></body></html>`;
}

const badge = (o) => `<span class="badge ${o.status === 'Shipped' ? 'done' : ''}">${o.status}</span>`;

function ordersPage() {
  const rows = orders.map((o) => `<tr><td><a href="/orders/${o.id}">#${o.id}</a></td><td>${o.customer}</td><td>${o.items}</td><td>${o.total}</td><td>${badge(o)}</td></tr>`).join('');
  return layout('Orders', `<h1>Orders</h1><table><thead><tr><th>Order</th><th>Customer</th><th>Items</th><th>Total</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>`);
}

function orderPage(o, saved) {
  const opt = (v, t) => `<option value="${v}" ${o.carrier === v ? 'selected' : ''}>${t}</option>`;
  return layout(`Order #${o.id}`, `${saved ? '<div class="ok">Shipment saved.</div>' : ''}<h1>Order #${o.id} ${badge(o)}</h1>
<div class="card"><strong>${o.customer}</strong><p>${o.items} · ${o.total}</p></div>
<form class="card" method="post" action="/orders/${o.id}"><h2 style="font-size:17px;margin:0">Shipment</h2>
<label for="carrier">Carrier</label><select id="carrier" name="carrier">${opt('', 'Choose a carrier')}${opt('dhl', 'DHL')}${opt('ups', 'UPS')}${opt('fedex', 'FedEx')}</select>
<label for="tracking">Tracking number</label><input id="tracking" name="tracking" value="${o.tracking}">
<button type="submit">Save shipment</button></form><p><a href="/orders">← All orders</a></p>`);
}

// The scripted stand-in for the model: one fixed chore, driven by the refs
// in the latest page read.
function scriptedTurn(req) {
  const step = req.messages.filter((m) => m.role === 'assistant').length;
  const lastRead = [...req.messages].reverse().flatMap((m) => m.content).find((b) => b.type === 'tool_result' && b.content.startsWith('Page:'));
  const ref = (label) => Number(lastRead?.content.split('\n').find((l) => l.startsWith('[') && l.includes(label))?.match(/^\[(\d+)\]/)?.[1]);
  const use = (name, input, n = step) => ({ type: 'tool_use', id: `t${n}_${name}`, name, input });
  const plan = [
    () => [{ type: 'text', text: 'Opening order #1042.' }, use('read_page', {})],
    () => [use('click', { ref: ref('"#1042"') })],
    () => [use('read_page', {})],
    () => [use('select_option', { ref: ref('"Carrier"'), option: 'DHL' }), use('type_text', { ref: ref('"Tracking number"'), text: 'JD014600' })],
    () => [{ type: 'text', text: 'Filled in DHL and JD014600. Saving needs your OK.' }, use('click', { ref: ref('"Save shipment"') })],
  ];
  const content = step < plan.length ? plan[step]() : [{ type: 'text', text: 'Order #1042 is marked shipped with DHL JD014600. Shall I do #1043 and #1044 the same way?' }];
  return {
    taskId: 'task_demo',
    content,
    stopReason: content.some((b) => b.type === 'tool_use') ? 'tool_use' : 'end_turn',
    step: step + 1,
    stepCap: 20,
    usage: { tasksUsed: 3, tasksIncluded: 30, extraTaskCents: 5, canExceed: false },
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
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'POST, DELETE' };
  if (req.method === 'OPTIONS') return res.writeHead(204, cors).end();
  if (url.pathname === '/api/secretary/v1/extension/turn' && req.method === 'POST') {
    const body = JSON.parse(await readBody(req));
    return res.writeHead(200, { ...cors, 'Content-Type': 'application/json' }).end(JSON.stringify(scriptedTurn(body)));
  }
  if (url.pathname === '/api/secretary/v1/extension/session') return res.writeHead(204, cors).end();
  if (url.pathname === '/secretary/extension/connect') {
    const back = new URL(url.searchParams.get('redirect_uri'));
    back.hash = new URLSearchParams({ token: 'demo', state: url.searchParams.get('state') ?? '', email: 'demo@example.com', expires_in: '86400' }).toString();
    return res.writeHead(302, { Location: back.toString() }).end();
  }
  const m = url.pathname.match(/^\/orders\/(\d+)$/);
  const o = m && orders.find((x) => x.id === Number(m[1]));
  if (o && req.method === 'POST') {
    const f = new URLSearchParams(await readBody(req));
    o.carrier = f.get('carrier') ?? '';
    o.tracking = f.get('tracking') ?? '';
    if (o.carrier && o.tracking) o.status = 'Shipped';
    return res.writeHead(303, { Location: `/orders/${o.id}?saved=1` }).end();
  }
  const html = o ? orderPage(o, url.searchParams.has('saved')) : ordersPage();
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(html);
}).listen(PORT, () => console.log(`demo on http://localhost:${PORT}`));
