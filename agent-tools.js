/* Tools are an optional enhancement. No UI, tracking, or external service. */
(async function () {
  'use strict';
  const registry = typeof document.modelContext?.registerTool === 'function'
    ? document.modelContext
    : (typeof navigator.modelContext?.registerTool === 'function' ? navigator.modelContext : null);
  if (!registry) return;

  const root = new URL('./', document.currentScript.src);
  const lifecycle = new AbortController();
  let cafePromise;
  const emptySchema = { type: 'object', properties: {}, additionalProperties: false };
  function validate(input, allowed = []) {
    if (!input || typeof input !== 'object' || Array.isArray(input) ||
        Object.keys(input).some(key => !allowed.includes(key))) throw new Error('Paramètres invalides.');
  }
  async function fetchFile(path, type = 'json') {
    const response = await fetch(new URL(path, root), { cache: 'no-store', signal: lifecycle.signal });
    if (!response.ok) throw new Error('Informations temporairement indisponibles.');
    return type === 'json' ? response.json() : response.arrayBuffer();
  }
  async function cafe() {
    if (!cafePromise) cafePromise = (async () => {
      let page = document;
      if (!page.querySelector('#cafe-data')) {
        const response = await fetch(new URL('index.html', root), { cache: 'no-store', signal: lifecycle.signal });
        if (!response.ok) throw new Error('Informations du café indisponibles.');
        page = new DOMParser().parseFromString(await response.text(), 'text/html');
      }
      return JSON.parse(page.querySelector('#cafe-data').textContent);
    })().catch(error => { cafePromise = null; throw error; });
    return cafePromise;
  }
  const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/œ/g, 'oe').replace(/[^a-z0-9]+/g, ' ').trim();

  const tools = [
    {
      name: 'get_cafe_info',
      description: 'Lire les coordonnées et les liens officiels de La Station Genval. Aucune réservation ni envoi.',
      inputSchema: emptySchema,
      async execute(input = {}) {
        validate(input);
        const data = await cafe();
        return { name: data.name, description: data.description, address: data.address,
          telephone: data.telephone, email: data.email, url: data.url,
          menu_url: data.hasMenu, social_links: data.sameAs,
          services: data.amenityFeature, source_url: data.url };
      },
    },
    {
      name: 'get_opening_hours',
      description: 'Lire les horaires habituels et les exceptions publiées du café, en heure de Bruxelles. Ne garantit pas une ouverture en temps réel.',
      inputSchema: emptySchema,
      async execute(input = {}) {
        validate(input);
        const data = await cafe();
        return { timezone: 'Europe/Brussels', regular_hours: data.openingHoursSpecification,
          published_exceptions: data.specialOpeningHoursSpecification || [],
          note: 'Horaires publiés. Pour une fermeture imprévue ou un jour férié, contacter le café.',
          source_url: data.url };
      },
    },
    {
      name: 'get_reservation_options',
      description: 'Obtenir la procédure pour réserver une table. Cet outil ne réserve pas et ne vérifie pas les disponibilités.',
      inputSchema: emptySchema,
      async execute(input = {}) {
        validate(input);
        const data = await cafe();
        return { method: 'telephone', telephone: data.telephone, url: 'tel:' + data.telephone,
          instructions: 'La réservation est recommandée. Appeler le café pour vérifier la disponibilité et réserver.',
          reservation_created: false, source_url: data.url + '#contact' };
      },
    },
    {
      name: 'search_menu',
      description: 'Rechercher dans la carte publiée de La Station Genval : noms, descriptions, catégories et prix en EUR. La carte ne garantit pas le stock. Allergènes et régimes alimentaires à confirmer auprès de l’équipe.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', maxLength: 120, description: 'Mots du nom ou de la description ; vide pour consulter la carte.' },
          category: { type: 'string', maxLength: 80, description: 'Catégorie, par exemple cafés, lunch ou petit-déjeuner.' },
          max_price: { type: 'number', minimum: 0, maximum: 1000, description: 'Prix maximum en euros, suppléments inclus dans les résultats comme articles séparés.' },
          limit: { type: 'integer', minimum: 1, maximum: 100 },
        },
        additionalProperties: false,
      },
      async execute(input = {}) {
        validate(input, ['query', 'category', 'max_price', 'limit']);
        for (const key of ['query', 'category']) {
          if (input[key] !== undefined && (typeof input[key] !== 'string' || input[key].length > (key === 'query' ? 120 : 80))) throw new Error('Recherche invalide.');
        }
        if (input.max_price !== undefined && (!Number.isFinite(input.max_price) || input.max_price < 0 || input.max_price > 1000)) throw new Error('Prix maximum invalide.');
        const limit = input.limit ?? 100;
        if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error('Limite invalide.');
        const menu = await fetchFile('menu.json');
        if (menu.schema_version !== 1 || !Array.isArray(menu.items) || !menu.source?.files?.length || !crypto.subtle) throw new Error('Carte indisponible. Consulter la page Menu ou contacter le café.');
        // Refuse stale data, including when only the PDF or an image was replaced.
        for (const source of menu.source.files) {
          if (!/^(Menu\.pdf|menu-page-[12]\.jpg)$/.test(source.path) || !/^[a-f0-9]{64}$/.test(source.sha256)) throw new Error('Source du menu invalide.');
          const bytes = await fetchFile(source.path, 'bytes');
          const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('');
          if (hash !== source.sha256) throw new Error('La carte a changé : recherche temporairement indisponible. Consulter menu.html ou contacter le café.');
        }
        const words = normalize(input.query || '').split(' ').filter(Boolean);
        const category = normalize(input.category || '');
        const matches = menu.items.filter(item => {
          const text = normalize([item.name, item.description, item.category].join(' '));
          return words.every(word => text.includes(word)) && normalize(item.category).includes(category) &&
            (input.max_price === undefined || (typeof item.price === 'number' && item.price <= input.max_price));
        });
        return { currency: menu.currency, total: matches.length, items: matches.slice(0, limit),
          truncated: matches.length > limit, source_url: new URL('menu.html', root).href,
          source_files: menu.source.visible_files.map(path => new URL(path, root).href),
          pdf_url: menu.source.pdf_matches_visible_menu ? new URL('Menu.pdf', root).href : null,
          note: menu.note };
      },
    },
  ];
  for (const tool of tools) {
    try {
      await registry.registerTool({ ...tool, annotations: { readOnlyHint: true } }, { signal: lifecycle.signal });
    } catch (error) {
      console.warn('La Station : outil IA indisponible (' + tool.name + ').', error);
    }
  }
  // Preserve registrations when the browser freezes the page in its back/forward cache.
  window.addEventListener('pagehide', event => { if (!event.persisted) lifecycle.abort(); });
})();
