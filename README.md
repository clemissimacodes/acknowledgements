# Acknowledgements

Visitors are inside Clementine Shao’s Messages. `/` is a plain Word-style page. `/acknowledgements` is the conversation list. Opening a thread shows only her outgoing blue bubbles. The name and chevron in the thread header open the iMessage contact card (`/acknowledgements/[slug]/contact`).

## Source

Rows live in the [Acknowledgements Notion database](https://app.notion.com/p/8f01c38233dc4cf785a4cf035b74df96). **Thank you message** is the thread: one sentence or paragraph per blue bubble.

The site reads Notion when `NOTION_TOKEN` is set (share the database with that integration). Otherwise it uses `data/acknowledgements.json`.

## Run locally

```bash
npm install
npm run dev
```
