// Reachability probe for the connectivity indicator. The browser's
// navigator.onLine flag is unreliable (it stays true when wifi drops), so the
// client fetches this endpoint to learn whether the server is *actually*
// reachable. Returns 204 with no body; must never be cached.

export const dynamic = 'force-dynamic';

export function GET() {
  return new Response(null, {
    status: 204,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}

export function HEAD() {
  return new Response(null, {
    status: 204,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}
