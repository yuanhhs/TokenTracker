// Canonical list of supported coding agents, in display order. Shared by the
// marketing landing carousel and the dashboard auth/expired gate so the two
// surfaces can't drift. Names are tooltip/a11y metadata only.

export const AGENT_LOGOS = [
  { id: 1, name: "Claude Code", provider: "claude" },
  { id: 2, name: "Codex", provider: "codex" },
  { id: 3, name: "Cursor", provider: "cursor" },
  { id: 4, name: "Gemini", provider: "gemini" },
  { id: 5, name: "Antigravity", provider: "antigravity" },
  { id: 6, name: "Kiro", provider: "kiro" },
  { id: 7, name: "Every Code", provider: "every-code" },
  { id: 8, name: "GitHub Copilot", provider: "copilot" },
  { id: 9, name: "Kimi", provider: "kimi" },
  { id: 10, name: "CodeBuddy", provider: "codebuddy" },
  { id: 11, name: "WorkBuddy", provider: "workbuddy" },
  { id: 12, name: "Grok", provider: "grok" },
  { id: 13, name: "oh-my-pi", provider: "omp" },
  { id: 14, name: "Pi", provider: "pi" },
  { id: 15, name: "Dots", provider: "dots" },
  { id: 16, name: "Prime Agent", provider: "prime-agent" },
  { id: 17, name: "Craft", provider: "craft" },
  { id: 18, name: "Reasonix", provider: "reasonix" },
  { id: 19, name: "Kilo CLI", provider: "kilo-cli" },
  { id: 20, name: "Kilo Code", provider: "kilocode" },
  { id: 21, name: "Roo Code", provider: "roocode" },
  { id: 22, name: "Goose", provider: "goose" },
  { id: 23, name: "Droid", provider: "droid" },
  { id: 24, name: "Mimo", provider: "mimo" },
  { id: 25, name: "ZCode", provider: "zcode" },
  { id: 26, name: "AnythingLLM", provider: "anythingllm" },
  { id: 27, name: "Claude Science", provider: "claude-science" },
  { id: 28, name: "DeepSeek Harness", provider: "dsh" },
  {
    id: 29,
    // No hardcoded English fallback name: every consumer renders through
    // copy() (LogoCarousel prefers nameKey; see LogoCarousel.test.jsx), so a
    // parallel "name" string would just duplicate the copy.csv entry.
    nameKey: "provider.display.trae_work_cn",
    provider: "trae-cn",
  },
];
