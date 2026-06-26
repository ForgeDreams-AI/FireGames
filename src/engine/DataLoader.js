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
      events: localEventsOverride() || events.events || events,
      map,
      wildNPCs,
      assets
    };
  }
};

// The Studio editor can "Apply locally" a draft events.json to this device for
// preview (localStorage). It overrides the file until cleared. Other devices /
// the published site are unaffected until the file is committed.
export const EVENTS_OVERRIDE_KEY = 'coreseven.eventsOverride.v1';
function localEventsOverride() {
  try {
    const raw = localStorage.getItem(EVENTS_OVERRIDE_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    const arr = d.events || d;
    return Array.isArray(arr) && arr.length ? arr : null;
  } catch (e) { return null; }
}
