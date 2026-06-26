// DataLoader.js — loads all JSON data files via relative fetch.
// No content lives here; it only fetches /src/data/*.json and /src/assets/manifest.json.
// Relative paths keep GitHub Pages + custom-domain swaps zero-code.

async function getJSON(path) {
  const res = await fetch(path, { cache: 'no-cache' });
  if (!res.ok) throw new Error('Failed to load ' + path + ' (' + res.status + ')');
  return res.json();
}

export const DataLoader = {
  base: '', // relative to index.html

  async loadAll() {
    const b = this.base;
    const [config, events, map, wildNPCs, assets] = await Promise.all([
      getJSON(b + 'src/data/config.json'),
      getJSON(b + 'src/data/events.json'),
      getJSON(b + 'src/data/map.json'),
      getJSON(b + 'src/data/wildNPCs.json'),
      getJSON(b + 'src/assets/manifest.json')
    ]);
    return {
      config,
      events: events.events || events,
      map,
      wildNPCs,
      assets
    };
  }
};
