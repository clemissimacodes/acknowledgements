# Acknowledgements

Visitors are inside Clementine Shao’s Messages. `/` is a plain Word-style page. `/acknowledgements` is the conversation list. Opening a thread shows only her outgoing blue bubbles. The name and chevron in the thread header open the iMessage contact card (`/acknowledgements/[slug]/contact`).

## Source

Rows live in the [Acknowledgements Notion database](https://app.notion.com/p/8f01c38233dc4cf785a4cf035b74df96). **Thank you message** is the thread: one sentence or paragraph per blue bubble.

The site reads Notion when `NOTION_TOKEN` is set (share the database with that integration). Otherwise it uses `data/acknowledgements.json`.

## Bad Company

`/bad-company` is the clearance rack behind Good Company: same store, lights off, every item final sale. It is owner-only (`BAD_COMPANY_LIVE` in `lib/bad-company.ts`), independent of `SHOP_LIVE`.

This repo is public, so the real roster is never committed. It loads from, in order:

1. `BAD_COMPANY_ROSTER` env var (a JSON array, set in Vercel)
2. `.data/bad-company.json` (gitignored, for local)
3. `data/bad-company.example.json` (placeholder archetypes; copy it to start)

Fields per item: `nickname`, `productName`, `badge` (`final-sale`, `recalled`, `discontinued`, `never-again`, `returned`), `relationship`, `metHow`, `hometown`, `madeOf`, `care`, `worstMemory`, `pairsBadlyWith`, `discontinued`, `condition`, `price`, optional `slug`, `heroUrl`, `visible`.

## Run locally

```bash
npm install
npm run dev
```
