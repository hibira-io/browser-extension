import { beforeEach, describe, expect, it } from 'vitest';
import { PageTools } from '../src/content/tools';

let tools: PageTools;
let url = 'https://shop.test/orders/42';

beforeEach(() => {
  url = 'https://shop.test/orders/42';
  document.title = 'Order 42';
  document.body.innerHTML = `
    <h1>Order 42</h1>
    <p>Status: waiting for shipment</p>
    <form id="f">
      <label for="carrier">Carrier</label>
      <select id="carrier"><option value="">Choose</option><option value="dhl">DHL</option></select>
      <label for="tracking">Tracking number</label><input id="tracking">
      <input id="pw" type="password" style="display:none">
      <button id="save">Save shipment</button>
    </form>
    <button type="button" id="more">Show history</button>`;
  tools = new PageTools(document, () => url);
});

function refOf(snapshot: string, label: string): number {
  const line = snapshot.split('\n').find((l) => l.startsWith('[') && l.includes(label));
  return Number(line?.match(/^\[(\d+)\]/)?.[1]);
}

describe('PageTools', () => {
  it('reads the page with refs', () => {
    const s = tools.run({ id: '1', name: 'read_page', input: {} }).output;
    expect(s).toContain('# Order 42');
    expect(s).toContain('Status: waiting for shipment');
    expect(s).toMatch(/\[\d+\] dropdown "Carrier" \(selected="Choose"\)/);
    expect(s).toMatch(/\[\d+\] button "Save shipment" \(submits\)/);
  });

  it('types, selects, and waits for approval before submitting', () => {
    let submitted = 0;
    document.getElementById('f')!.addEventListener('submit', (e) => {
      e.preventDefault();
      submitted++;
    });
    const s = tools.run({ id: '1', name: 'read_page', input: {} }).output;
    expect(tools.run({ id: '2', name: 'type_text', input: { ref: refOf(s, 'Tracking'), text: 'JD0142' } }).ok).toBe(true);
    expect(tools.run({ id: '3', name: 'select_option', input: { ref: refOf(s, 'Carrier'), option: 'DHL' } }).ok).toBe(true);
    const save = refOf(s, 'Save shipment');
    const ask = tools.run({ id: '4', name: 'click', input: { ref: save } });
    expect(ask.needsApproval).toBe(true);
    expect(ask.approval?.summary).toEqual(['Carrier: DHL', 'Tracking number: JD0142']);
    expect(submitted).toBe(0);
    expect(tools.run({ id: '5', name: 'click', input: { ref: save }, approved: true }).ok).toBe(true);
    expect(submitted).toBe(1);
  });

  it('clicks ordinary buttons without asking', () => {
    let clicked = false;
    document.getElementById('more')!.addEventListener('click', () => (clicked = true));
    const s = tools.run({ id: '1', name: 'read_page', input: {} }).output;
    expect(tools.run({ id: '2', name: 'click', input: { ref: refOf(s, 'Show history') } }).ok).toBe(true);
    expect(clicked).toBe(true);
  });

  it('does nothing on sign-in pages', () => {
    url = 'https://shop.test/login';
    const r = tools.run({ id: '1', name: 'read_page', input: {} });
    expect(r.ok).toBe(false);
    expect(r.blocked).toBe('login');
  });

  it('never types into secret fields', () => {
    document.body.innerHTML = '<input id="cc" autocomplete="cc-number" aria-label="Card">';
    const s = tools.run({ id: '1', name: 'read_page', input: {} }).output;
    const r = tools.run({ id: '2', name: 'type_text', input: { ref: refOf(s, 'Card'), text: '4242' } });
    expect(r.ok).toBe(false);
    expect((document.getElementById('cc') as HTMLInputElement).value).toBe('');
  });
});
