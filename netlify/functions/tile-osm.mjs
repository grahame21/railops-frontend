export default async (req, context) => {
  try {
    // /tiles/osm/{z}/{x}/{y}.png → capture z/x/y
    const m = req.path.match(/\/tiles\/osm\/(\d+)\/(\d+)\/(\d+)\.png$/);
    if (!m) return new Response('Bad request', { status: 400 });

    const [, z, x, y] = m;
    const url = `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;

    const upstream = await fetch(url, {
      headers: {
        // identify politely; ORMs/OSM like a UA string
        'User-Agent': 'RailOps/1.0 (+https://traintracker2-0.netlify.app)',
        'Accept': 'image/png,image/*;q=0.8'
      },
      // Netlify edge fetch automatically supports HTTP/2
    });

    if (!upstream.ok) {
      return new Response(`Upstream OSM error ${upstream.status}`, { status: 502 });
    }

    // Forward the image body with caching headers
    const headers = new Headers(upstream.headers);
    headers.set('Cache-Control', 'public, max-age=86400, s-maxage=86400');
    headers.set('Content-Type', 'image/png');

    return new Response(upstream.body, { status: 200, headers });
  } catch (e) {
    return new Response('Fetch failed', { status: 502 });
  }
};