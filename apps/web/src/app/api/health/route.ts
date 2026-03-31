/**
 * KuratorMind AI — Backend Health Proxy
 *
 * Proxies health checks to the Python backend server-side,
 * eliminating CORS issues entirely. The browser only talks
 * to Next.js (same origin), and Next.js talks to the backend
 * server-to-server (no CORS needed).
 */

const AGENT_API_URL =
  process.env.NEXT_PUBLIC_AGENT_API_URL ?? "http://localhost:8000";

export async function GET() {
  try {
    const res = await fetch(`${AGENT_API_URL}/health`, {
      signal: AbortSignal.timeout(3000),
      cache: "no-store",
    });

    if (res.ok) {
      const data = await res.json();
      return Response.json({ online: true, ...data });
    }

    return Response.json({ online: false }, { status: 502 });
  } catch {
    return Response.json({ online: false }, { status: 502 });
  }
}
