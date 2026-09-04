import type { AcknowledgementRow } from "@/lib/notes";

const NOTION_VERSION = "2022-06-28";
const DATABASE_ID =
  process.env.NOTION_DATABASE_ID ?? "8f01c38233dc4cf785a4cf035b74df96";

type NotionRichText = { plain_text?: string };
type NotionProperty = {
  type?: string;
  title?: NotionRichText[];
  rich_text?: NotionRichText[];
  select?: { name?: string } | null;
  date?: { start?: string | null } | null;
  checkbox?: boolean;
};

type NotionPage = {
  properties?: Record<string, NotionProperty>;
};

function plain(parts: NotionRichText[] | undefined): string | undefined {
  const text = (parts ?? []).map((part) => part.plain_text ?? "").join("").trim();
  return text || undefined;
}

function propertyText(property: NotionProperty | undefined): string | undefined {
  if (!property) return undefined;
  if (property.type === "title") return plain(property.title);
  return plain(property.rich_text);
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function pageToRow(page: NotionPage): AcknowledgementRow | null {
  const properties = page.properties ?? {};
  const name = propertyText(properties.Name);
  if (!name) return null;

  return {
    name,
    slug: propertyText(properties.Slug) ?? slugify(name),
    first: propertyText(properties.First),
    last: propertyText(properties.Last),
    place: propertyText(properties["Meeting place"]),
    date: properties["Known since"]?.date?.start?.slice(0, 10) || undefined,
    notes: propertyText(properties.Notes),
    relationship: properties.Relationship?.select?.name,
    example: Boolean(properties.Sample?.checkbox),
    message: propertyText(properties["Thank you message"]),
  };
}

export async function fetchAcknowledgementRows(): Promise<AcknowledgementRow[] | null> {
  const token = process.env.NOTION_TOKEN;
  if (!token) return null;

  const rows: AcknowledgementRow[] = [];
  let cursor: string | undefined;

  do {
    const response = await fetch(
      `https://api.notion.com/v1/databases/${DATABASE_ID}/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Notion-Version": NOTION_VERSION,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          page_size: 100,
          start_cursor: cursor,
        }),
        next: { revalidate: 60 },
      },
    );

    if (!response.ok) {
      throw new Error(`Notion query failed (${response.status})`);
    }

    const payload = (await response.json()) as {
      results?: NotionPage[];
      has_more?: boolean;
      next_cursor?: string | null;
    };

    for (const page of payload.results ?? []) {
      const row = pageToRow(page);
      if (row) rows.push(row);
    }

    cursor = payload.has_more && payload.next_cursor ? payload.next_cursor : undefined;
  } while (cursor);

  return rows;
}
