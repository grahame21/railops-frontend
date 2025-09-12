// netlify/functions/tile-orm.js
const HOSTS = ['a.tile.openrailwaymap.org','b.tile.openrailwaymap.org','c.tile.openrailwaymap.org'];

export default async (req) => {
  try {
    const parts = req.path.split('/').slice(-3);
    const [z, x, file] = parts;
    const y = file.replace('.png', '');

    // simple host shuffle for resilience
    const host = HOSTS[Math.floor(Math.random() * HOSTS.length)];
    const upstream = `https://${host}/standard/${z}/${x}/${y}.png`;

    const r = await fetch(upstream, { headers: { 'User-Agent': 'RailOps Netlify tile proxy' }});
    if (!r.ok) return new Response('Upstream error', { status: r.status });

    const body = await r.arrayBuffer();
    return new Response(body, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800'
      }
    });
  } catch (e) {
    return new Response('Fetch failed', { status: 502 });
  }
}