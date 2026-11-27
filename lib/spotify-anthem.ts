import { spotifyTrackId } from "@/lib/friend-types";

export type AnthemMeta = { title: string; artist: string };

/* Resolve track title + artist from Spotify's public embed page (no API key). */
export async function fetchAnthemMeta(url: string): Promise<AnthemMeta | null> {
  const id = spotifyTrackId(url);
  if (!id) return null;
  try {
    const res = await fetch(`https://open.spotify.com/embed/track/${id}`, {
      headers: { "user-agent": "Mozilla/5.0" },
      next: { revalidate: 60 * 60 * 24 * 7 },
    });
    if (!res.ok) return null;
    const html = await res.text();
    const titleRaw = /"title":"((?:\\.|[^"\\])*)"/.exec(html)?.[1];
    const artistsBlock = /"artists":(\[[^\]]*\])/.exec(html)?.[1];
    const title = titleRaw ? (JSON.parse(`"${titleRaw}"`) as string) : "";
    let artist = "";
    if (artistsBlock) {
      try {
        const artists = JSON.parse(artistsBlock) as Array<{ name?: string }>;
        artist = artists.map((a) => a.name).filter(Boolean).join(", ");
      } catch {
        artist = "";
      }
    }
    if (!title) return null;
    return { title, artist };
  } catch {
    return null;
  }
}
