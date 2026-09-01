# Acknowledgements

Visitors are inside Clementine Shao’s Messages. `/` is a plain Word-style page. `/acknowledgements` is the conversation list. Opening a thread shows only her outgoing blue bubbles.

Sample threads (Marisol, Priya, the man with the red umbrella) are fiction, marked Sample in the list, and **should be deleted before a real launch**.

## Add a note

1. Create a markdown file in `notes/`.
2. Use this frontmatter. `date` and `place` are optional. `example: true` marks a sample and should not be used for real notes.

```yaml
---
name: first name, or a scene-title like “the barista who…”
slug: url-piece
hook: one-line preview in the conversation list
date: 2019-06-12
place: Oakland
example: false
---
```

3. Write the body as short paragraphs. Each paragraph becomes one blue bubble. Do not put a signature in the file; the layout supplies Sent.
4. Restart or rebuild. The new conversation appears in the list, newest `date` first.

Search filters by name only. A miss leaves the list unchanged (no empty state, no result count).

## Run locally

```bash
npm install
npm run dev
```

```bash
npm run build
npm start
```
