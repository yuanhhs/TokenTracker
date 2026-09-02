# TokenTracker — Product Context

register: product

## Product purpose

Local-first AI token-usage tracker for Windows. Parses logs from AI coding CLIs (Claude Code, Codex, Cursor, Gemini, Copilot, Kimi, and more) into a local dashboard so developers can see token usage, estimated cost, and trends. Privacy-first: token counts only, never prompts or conversation bodies. Ships as a self-contained Windows system-tray app with an embedded local server and dashboard.

## Users

Windows developers and AI power users who run multiple agent CLIs daily and want a single, trustworthy local view of consumption and cost. They distrust inflated numbers, so accuracy and legible key metrics matter more than decoration.

## Tone & principles

- Quiet, precise, trustworthy. The tool disappears into the task. Earned familiarity over novelty.
- Numbers are the hero content, but never the gradient-glow "hero-metric" cliché. Big figures must stay legible and never clip.
- The embedded Windows dashboard must work across compact and large desktop windows without horizontal scrolling for core metrics.
- Per-provider breakdown is secondary detail: fine to defer to a tap/expand on small screens.

## Anti-references

- SaaS-cream landing-page gloss, neon-on-black "crypto" dashboards, gratuitous glassmorphism.
- Wide data tables that force horizontal scrolling on phones and bury the key column off-screen.
- Fluid/clamp display type that shrinks unpredictably inside narrow panels.
