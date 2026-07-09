# Known Limitations

- Media / image generation is intentionally out of scope.
- OpenAI SDK typings can lag Responses `web_search` fields; the provider uses a narrow runtime wrapper.
- Vector search RPCs may warn and fall back to chronological context if SQL is outdated — re-run `p5`/`p6` combined migrations.
- Explore layout auto-places new chats on a collision-free grid; manually dragged positions are persisted and preferred.
- Large unused shadcn primitives may remain under `components/ui/` from the initial scaffold; prefer existing used components (`button`, `card`, `input`, etc.) before adding new UI kits.
- Citations are streamed live and also reconstructed from markdown links on chat reload (not a separate DB column yet).
