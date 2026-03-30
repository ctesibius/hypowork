
Concise Stack Architecture: AutoResearch Inc. (Zero-Human Engineering & Research Firm)

Core Goal
Autonomous, self-improving system that runs research experiments, optimizes designs, generates project lifecycle docs (CDR/TRR/MRR/etc.), and maintains perfect institutional memory — orchestrated with governance, dual memory layers, and founder visibility.

High-Level Layers

Orchestration & Governance (Paperclip)
Node.js + React dashboard
Org chart + heartbeats + budgets + audit logs
CEO Agent → sets vision/projects/missions
Research Director → spawns/monitors specialized pods
Agent Pods (Specialized Sub-Agents)
Design Engineer Pods (N) — research/optimize design artifacts
Project Engineer Pods (N) — lifecycle docs & milestones (CDR/TRR/MRR)
Runtime: Claude Code session + isolated git worktree + GPU/container (Docker)
Core loop: Generalized Autoresearch pattern
Read mission/program.md
Edit single artifact (train.py / design_spec.md / project_plan.md)
Run eval (5-min budget or sim)
Parse metric → keep (advance branch) or discard
No human in loop
Dual Memory System
Runtime / Per-Agent Memory → Mem0 (MCP server)
Vector + graph store
User/session/agent scopes
Auto fact extraction, semantic retrieval
+26% accuracy, 90% token savings
Shared / Long-Term Knowledge → Arscontexta vault
Markdown files + graphs
/research/claims/
/skills/marketplace/ (reusable patterns)
/ops/6R-logs/ (reflect → reweave → verify cycles)
MOCs for navigation/cross-pod transfer
Sync: Post-iteration hooks → Mem0.add() + Arscontexta /reflect
Visibility & Control (Founder Layer)
Note Viewer (Paperclip dashboard tab)
Live search across Mem0 + Arscontexta
Rendered, linked views of notes/claims/docs
Project milestones, experiment history, design decisions
Mobile-ready dashboard for real-time monitoring
Data Flow Summary
Vision/Projects (CEO)
→ Missions to Pods
→ Autoresearch-style iterations
→ Results → Mem0 (fast recall) + Arscontexta (structured refinement)
→ Research Director reads vault → spawns/adapts next pods
→ You view everything in Note Viewer

Key Tech

Paperclip (orchestration)
Autoresearch pattern (loop core)
Arscontexta (shared second brain)
Mem0 (agent memory)
Docker + git worktrees (isolation)
Claude Code (agent brains)
This is the full, layered, production-oriented design — concise yet complete.

Paperclip (CEO Layer)
├── Org Chart
│   ├── CEO Agent – owns Projects & Vision, sets missions/budgets
│   ├── Research Director – spawns/monitors specialized pods
│   ├── Design Engineer Pod (N instances)
│   │   ├── Isolated git worktree + GPU/container
│   │   ├── Powered by Claude Code + Mem0 MCP memory
│   │   └── Equipped with full Arscontexta vault
│   └── Project Engineer Pod (N instances)
│       ├── Same isolated runtime
│       ├── Mem0 for personal lifecycle memory
│       └── Arscontexta for shared project docs
└── Shared Knowledge Layer
    ├── Arscontexta vault (claims / skills / 6R-logs / MOCs)
    ├── Mem0 backend (vector + graph store, per-agent memories)
    └── Note Viewer (Paperclip dashboard tab)
        ├── Live search across Arscontexta + Mem0
        ├── Rendered views of CDR/TRR/MRR notes
        └── Founder-only read access with version history