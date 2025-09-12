// netlify/functions/tile-osm.js
export default async (req) => {
  try {
    // req.path like: /tiles/osm/5/27/19.png
    const parts = req.path.split('/').slice(-3);
    const [z, x, file] = parts;
    const y = file.replace('.png', '');
    const upstream = `https://a.tile.openstreetmap.org/${z}/${x}/${y}.png`;

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