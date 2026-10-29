const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');

const root = path.resolve(__dirname, '..');
async function load({ supported = true, legacy = false, failOne = false, changed = null } = {}) {
  const tools = new Map();
  // Stable search fixtures: future changes to the actual menu must not require
  // rewriting the expected search behavior. Source hashes still use real files.
  const fixtureItems = [
    ['Cappuccino', 4, 'Cafés', ''], ['Toast Fig Kiss', 15, 'Lunch', 'Chèvre frais, figues, jambon cru'],
    ['Espresso', 2.8, 'Cafés', ''], ['Double Espresso', 3.5, 'Cafés', ''],
    ['Lungo', 3.2, 'Cafés', ''], ['Americano', 3.5, 'Cafés', ''],
    ['Œuf bio', 2.5, 'Extras lunch', ''],
  ].map(([name, price, category, description]) => ({ name, price, category, description }));
  const events = new Map();
  const html = await fs.readFile(path.join(root, 'index.html'), 'utf8');
  const cafeJSON = html.match(/id="cafe-data">([\s\S]*?)<\/script>/)[1];
  const registry = { async registerTool(tool) {
    if (failOne && tool.name === 'get_cafe_info') throw Error('Unsupported tool');
    tools.set(tool.name, tool);
  } };
  const context = {
    document: {
      currentScript: { src: 'https://lastation-genval.be/agent-tools.js' },
      querySelector: () => ({ textContent: cafeJSON }),
      ...(supported && !legacy ? { modelContext: registry } : {}),
    },
    navigator: legacy ? { modelContext: registry } : {},
    window: { addEventListener: (type, callback) => events.set(type, callback) },
    URL, AbortController, crypto: webcrypto,
    console: { warn() {} },
    fetch: async url => {
      let name = new URL(url).pathname.slice(1);
      if (!['Menu.pdf', 'menu.json', 'menu-page-1.jpg', 'menu-page-2.jpg'].includes(name)) throw Error('Unexpected fetch');
      const bytes = changed === name ? Buffer.from('changed') : await fs.readFile(path.join(root, name));
      return { ok: true, json: async () => ({ ...JSON.parse(bytes), items: fixtureItems, source: { ...JSON.parse(bytes).source, pdf_matches_visible_menu: false } }), arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };
    },
  };
  await vm.runInNewContext(await fs.readFile(path.join(root, 'agent-tools.js'), 'utf8'), context);
  return { tools, events };
}

test('unsupported browser is a no-op; modern and legacy registries expose four tools', async () => {
  assert.equal((await load({ supported: false })).tools.size, 0);
  assert.equal((await load()).tools.size, 4);
  assert.equal((await load({ legacy: true })).tools.size, 4);
  assert.equal((await load({ failOne: true })).tools.size, 3);
});

test('contact, hours and reservations are factual read-only results', async () => {
  const { tools } = await load();
  const info = await tools.get('get_cafe_info').execute();
  assert.equal(info.telephone, '+32470211481');
  assert.equal(info.url, 'https://lastation-genval.be/');
  assert.equal(info.address.postalCode, '1332');
  const hours = await tools.get('get_opening_hours').execute();
  assert.equal(hours.timezone, 'Europe/Brussels');
  assert.equal(hours.regular_hours[0].opens, '07:00');
  assert.equal(hours.regular_hours[0].closes, '14:00');
  assert.equal(hours.regular_hours[0].dayOfWeek.length, 5);
  const reservation = await tools.get('get_reservation_options').execute();
  assert.equal(reservation.reservation_created, false);
  await assert.rejects(tools.get('get_cafe_info').execute({ send_email: true }));
});

test('search handles names, accents, categories, prices and an archived PDF link', async () => {
  const { tools } = await load();
  const search = tools.get('search_menu').execute;
  const all = await search();
  assert.equal(all.total, 7);
  assert.equal(all.pdf_url, null);
  const cappuccino = await search({ query: 'CAPPUCCINO' });
  assert.equal(cappuccino.total, 1);
  assert.equal(cappuccino.items[0].price, 4);
  const fig = await search({ query: 'fig kiss' });
  assert.equal(fig.total, 1);
  assert.equal(fig.items[0].price, 15);
  assert.match(fig.items[0].description, /jambon cru/);
  assert.equal((await search({ query: 'mortadream' })).total, 0);
  const cheap = await search({ category: 'cafes', max_price: 3.5 });
  assert.equal(cheap.total, 4); // Includes Americano, missing from the old PDF.
  assert.equal((await search({ query: 'oeuf', category: 'extras' })).total, 1);
  assert.equal((await search({ query: 'produit introuvable' })).total, 0);
  const limited = await search({ limit: 2 });
  assert.equal(limited.items.length, 2);
  assert.equal(limited.truncated, true);
});

test('invalid inputs and stale image/PDF data fail rather than returning misleading prices', async () => {
  const search = (await load()).tools.get('search_menu').execute;
  for (const input of [null, [], { query: 4 }, { query: 'a'.repeat(121) }, { max_price: -1 }, { max_price: Infinity }, { limit: 0 }, { limit: 1.5 }, { unknown: true }]) {
    await assert.rejects(search(input));
  }
  for (const changed of ['Menu.pdf', 'menu-page-1.jpg', 'menu-page-2.jpg']) {
    const staleSearch = (await load({ changed })).tools.get('search_menu').execute;
    await assert.rejects(staleSearch({ query: 'cappuccino' }), /carte a changé/);
  }
});

test('all public pages load the optional tools; business metadata uses the public domain', async () => {
  for (const name of ['index.html', 'menu.html', 'mentions-legales.html']) {
    const html = await fs.readFile(path.join(root, name), 'utf8');
    assert.match(html, /<script src="agent-tools.js" defer><\/script>/);
    assert.doesNotMatch(html, /https:\/\/github.com\/Gustomucho\/lastation-genval/);
    for (const match of html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
      assert.doesNotThrow(() => JSON.parse(match[1]));
    }
  }
});
