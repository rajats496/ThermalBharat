---
description: "Explain selected code with clear structure, risks, and next steps"
name: "Explain Code Clearly"
argument-hint: "Audience (junior/senior), depth (quick/detailed), focus (logic/perf/security/tests)"
agent: "agent"
---
Explain the selected code and nearby context for maintainers.

Requirements:
- Start with a 2-4 sentence summary of what the code does.
- Describe the control flow in execution order.
- Call out assumptions, edge cases, and failure paths.
- Identify concrete risks or code smells with severity (high/medium/low).
- Suggest the smallest safe improvement steps.

Inputs:
- Use current selection as the primary source.
- If needed, inspect adjacent functions/types in the same file.
- If arguments are provided, adapt output to requested audience/depth/focus.

Output format:
1. Purpose
2. How It Works
3. Risks
4. Minimal Improvements
5. Open Questions

Style:
- Be precise and concise.
- Reference symbols and files when relevant.
- Avoid restating obvious syntax.
