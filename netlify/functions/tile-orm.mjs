const HOSTS = [
  'a.tile.openrailwaymap.org',
  'b.tile.openrailwaymap.org',
  'c.tile.openrailwaymap.org'
];

async function tryFetch(url) {
  return fetch(url, {
    headers: {
      'User-Agent': 'RailOps/1.0 (+https://traintracker2-0.netlify.app)',
      'Accept': 'image/png,image/*;q=0.8',
      // Some tile servers like having *a* Referer; use their site
      'Referer': 'https://www.openrailwaymap.org/'
    }
  });
}

export default async (req, context) => {
  try {
    const m = req.path.match(/\/tiles\/orm\/(\d+)\/(\d+)\/(\d+)\.png$/);
    if (!m) return new Response('Bad request', { status: 400 });

    const [, z, x, y] = m;

    // Randomize first host, then fall back through the rest
    const start = Math.floor(Math.random() * HOSTS.length);
    const order = [...HOSTS.slice(start), ...HOSTS.slice(0, start)];

    let lastErr = null;
    for (const host of order) {
      const url = `https://${host}/standard/${z}/${x}/${y}.png`;
      try {
        const r = await tryFetch(url);
        if (r.ok) {
          const headers = new Headers(r.headers);
          headers.set('Cache-Control', 'public, max-age=86400, s-maxage=86400');
          headers.set('Content-Type', 'image/png');
          return new Response(r.body, { status: 200, headers });
        }
        lastErr = new Error(`HTTP ${r.status}`);
      } catch (e) {
        lastErr = e;
      }
    }

    return new Response(`All ORM hosts failed: ${lastErr?.message || 'unknown'}`, { status: 502 });
  } catch (e) {
    return new Response('Fetch failed', { status: 502 });
  }
};