AI-native Hardware Development Life Cycle (HDLC) orchestration platform that avoids the bloat of traditional enterprise PLM tools (like Siemens Teamcenter or Arena) while giving small teams/startups the same agent-driven efficiency Software Factory delivers for software. 

8090.ai

Software Factory (from 8090.ai) is an AI-orchestrated SDLC platform with four core modules:Refinery for collaborative requirements refinement.
Foundry for capturing architecture/blueprints.
Planner for breaking intent into structured work orders (with AI agent execution via MCP).
Validator for turning feedback into actionable tasks. 

8090.ai

The workflow is simple: create a project, define requirements → blueprints → extract/assign work orders → connect coding agents (e.g., Cursor/Claude) to execute and sync back. It grounds everything in documents for humans + AI, with features like simplified Planner v2 (Gantt/Kanban views, dependency mapping), global search, and agent-driven work orders. No Jira-style complexity—just focused orchestration for high-quality output. 

8090.ai

A hardware clone (let's call it "Hardware Factory" for now) maps perfectly but swaps code/Git for CAD files, BOMs, simulations, fab, and supply chain realities. Here's how it would work:Adapted Modules for Mechanical + PCB DesignRefinery — Collaborative workspace for product requirements (functional specs, mechanical constraints, electrical needs, compliance). AI agents debate/refine with you (e.g., "Add thermal limits for this enclosure").
Foundry — System blueprints: high-level architecture, early CAD concepts, schematics, or block diagrams. Agents help generate initial models or constraint sets.
Planner v2 (the star) — Translate intent into structured work orders (e.g., "Generate PCB layout from schematic + enclosure fit", "Run FEA simulation on bracket", "Order prototype PCBs"). Include Gantt for long-lead items (fab/assembly timelines), Kanban boards for tasks, dependency mapping (PCB must finish before mechanical integration), and global search across projects, drawings, BOMs, and test data. MCP-style tool connects to hardware agents for auto-creating/ executing orders.
Validator — Ingest simulation results, prototype test data, or field feedback and auto-generate fixes (e.g., "Tolerance issue detected—update drawing").

AI Agent Superpowers (Hardware Edition)Agents wouldn't just write code—they'd:Suggest/generate BOMs with real-time sourcing (cost, lead time, alternatives).
Assist CAD: Pull into Onshape/Fusion 360 for mechanical generative design, or KiCad/Altium for PCB routing/simulation.
Orchestrate workflows: "Create work order for thermal analysis" or "Compare 3 versions of enclosure".
Handle reviews: Flag DFM issues, tolerances, or assembly conflicts automatically.

This mirrors Software Factory's agent orchestration but for physical products. Emerging AI (generative CAD, vision-based analysis) makes it realistic now.Key Shared + Hardware-Specific FeaturesGlobal search & navigation across requirements, blueprints, CAD metadata, BOMs, and sim reports.
MCP enhancements for agent-driven work orders (connect to cloud CAD APIs instead of GitHub).
Teased extras like in-app notifications (e.g., "Prototype ready at manufacturer") and document modes (view/edit drawings/schematics inline).
Cloud-first: Versioned CAD (Onshape handles this natively), 3D viewers, BOM intelligence.

Integrations That Make It RealMechanical: Onshape (best-in-class REST API + native versioning), Fusion 360, SolidWorks.
PCB/Electronics: KiCad (open-source scripting), Altium 365.
BOM/Sourcing: Digi-Key/Octopart APIs, real-time pricing.
Manufacturing: Links to PCBWay/JLCPCB for instant quotes.
Extras: Simulation tools (ANSYS-like), supply chain trackers.

Tech Stack to Build It (Feasible & Modern)Use the same modern web foundation as Software Factory:Frontend (React/Next.js) + backend (Node/Python).
AI orchestration via LangGraph or similar agent frameworks (open-source examples exist for SDLC-style workflows).
Database for documents + metadata.
CAD APIs + computer vision (for analyzing STEP/ Gerber files like bananaz does).
Deploy on cloud (AWS/GCP) with LLM backends (Grok, Claude, or GPT for agents).

MVP timeline: 3–6 months for core (if you have a small team), starting with Onshape + KiCad integrations and basic agents.



Project Plan & Architecture for Hardware Factory
Role: Senior Tech Lead (reporting directly to you)
Team Size: 7 developers (scalable to 10 post-MVP)
Goal: Build a lightweight, AI-native HDLC platform that mirrors Software Factory’s Refinery → Foundry → Planner v2 → Validator flow, but for mechanical + PCB hardware. MVP ready in 4–5 months (target launch: August 2026).  1. Team Structure & ResponsibilitiesYou (Product Owner) – Prioritization, hardware domain validation  
Me (Senior Lead / Full-stack) – Architecture, code reviews, agent orchestration  
Frontend Lead – Next.js UI, 3D viewers, Gantt/Kanban  
2× Backend Engineers – FastAPI, DB, integrations  
AI Agent Engineer – LangGraph workflows, tool calling, MCP-style connectors  
Integration/DevOps Engineer – Onshape/KiCad APIs, CI/CD, deployment  
QA/Designer (contract or part-time) – Wireframes, E2E testing

Weekly cadence:  Mon: Sprint planning + architecture sync  
Wed: Agent demo (live work-order execution)  
Fri: Demo to you + retro

Tools: Linear (issues), GitHub (code), Figma (wireframes), Notion (spec), Sentry + LangSmith (observability).2. High-Level System Architecture (2026-Ready)We use a modular monolith for MVP (fast iteration, single deploy). Split into microservices only after v1 if traffic demands.

Frontend (Next.js 15 App Router)
   ↓ (Server Actions + TanStack Query)
Backend (FastAPI)
   ├── Auth (Clerk / Supabase Auth)
   ├── Core Modules (Refinery, Foundry, Planner, Validator)
   ├── Agent Orchestration Layer (LangGraph + FastAPI endpoints)
   ├── Integrations Layer (Onshape REST v12, KiCad IPC via kicad-python)
   └── Storage & Search
         ├── PostgreSQL (projects, work orders, metadata)
         ├── Qdrant (vector search over requirements + CAD descriptions)
         ├── S3 (cached exports, test data)
         └── Redis (caching, WebSocket sessions)

Key Design Decisions (updated for March 2026):Onshape is still the gold-standard cloud CAD: full REST API (V12 with stricter typing, async STEP export, webhooks, document create/copy, BOM/ERP sync, new Model-Based Definition & URDF export). We call it directly from agents—no local CAD server needed.
KiCad 10 (released ~Feb 2026): Deprecated SWIG bindings replaced by stable IPC API + official kicad-python PyPI package. Perfect for agent-driven ERC/DRC, layout automation, jobsets.
AI Layer: LangGraph (S-tier production framework in 2026) for stateful multi-agent workflows. Each work order = a LangGraph graph with human-in-loop approval. Tools include Onshape/KiCad MCP connectors + Octopart/Digi-Key + JLCPCB quote APIs.
Validation boost: Optional bananaz.ai Design Agent webhook (their 2026 agent now does real-time DFM, GD&T, tolerance stack-up, change detection via computer vision). We start with our own lightweight vision layer and swap in bananaz for premium users.

Data Flow Example (Drone Frame + Flight Controller project):Refinery → requirements doc (vectorized)  
Foundry → Onshape document created via API + initial assembly  
Planner → “Generate enclosure concepts” work order → LangGraph agent calls Onshape FeatureScript + generates 3 variants  
Validator → Run FEA (hook to Onshape Simulation) + bananaz-style geometry check → auto-create fix order

3. Module Architecture BreakdownEach module is a self-contained FastAPI router + React page set.Module
Core Responsibilities
Key Tech / APIs
AI Agents Involved
Refinery
Requirements capture, refinement, versioning
Markdown + structured YAML, Qdrant semantic search
Requirements Debater Agent
Foundry
Blueprints, system architecture, early CAD
Onshape doc creation, block-diagram renderer
Blueprint Generator (Onshape API)
Planner v2
Work orders, Gantt, Kanban, dependencies, global search
React-Gantt, react-beautiful-dnd, dependency graph (Cytoscape)
Work-Order Executor (LangGraph)
Validator
Simulation ingest, DFM checks, change detection
Onshape Simulation export + KiCad DRC + optional bananaz webhook
Validation Agent + Change Detector

4. Detailed Project Plan (Agile, 2-week sprints)Total MVP Timeline: 18–20 weeks (4.5 months)
Start: Week of March 24, 2026 → Launch-ready: August 2026Phase 0: Foundation (Weeks 1–2)  Repo setup, monorepo (Turborepo), CI/CD (GitHub Actions + Docker)  
Auth, project CRUD, basic DB schema  
Wireframes for all 4 modules (Figma)  
Milestone: Empty shell running locally

Phase 1: Core + Refinery/Foundry (Weeks 3–8)  Refinery full UI + document versioning  
Foundry: Onshape OAuth + “Create Document” + BOM sync  
Global semantic search (Qdrant)  
Milestone: End-to-end project creation with Onshape link (demo: March 2026 Onshape MBD support)

Phase 2: Planner v2 + Agent Core (Weeks 9–16)  Work-order engine + Gantt/Kanban + dependency mapping  
LangGraph base graph + 3 core tools:  Onshape Document/Export tool  
KiCad IPC (schematic validation)  
BOM sourcing (Octopart)

Notifications (WebSocket + in-app)  
Milestone: Live agent creating & executing a PCB layout order

Phase 3: Validator + Polish + Beta Prep (Weeks 17–20)  Validator UI + simulation ingest  
bananaz.ai integration hook (optional)  
E2E tests (Playwright), rate-limit handling, security audit  
Deploy to Vercel + Fly.io (or AWS if preferred)  
Milestone: Closed beta with 3 test hardware projects (e.g., drone, IoT board, robotic arm)

Post-MVP Roadmap (Q3–Q4 2026)  Q3: Full KiCad layout automation agent, JLCPCB ordering flow  
Q4: Multi-user permissions, enterprise SSO, advanced simulation swarm

Budget Estimate (7-person team, remote)  4.5 months @ average $12k/month per dev = ~$380k (including AI API credits ~$15k)  
Can reduce to $250k with 5-person core team.

5. Risks & Mitigations (2026 reality)Onshape/KiCad API rate limits → Built-in queue + caching layer  
AI hallucinations in work orders → Human approval gate + LangSmith tracing + RAG over project docs  
CAD file bloat → Never store raw CAD; always reference Onshape/KiCad cloud  
Competitor overlap (Duro Design now under Altium, bananaz stronger agents) → Our differentiator = true work-order-first orchestration + open MCP tools (exactly like Software Factory)

Next Steps (this week)I’ll send you the GitHub repo skeleton + Figma link by EOD tomorrow.  
Kickoff call Wednesday 10am your time to lock sprint 1 backlog.  
First deliverable: Working Onshape OAuth + document creation endpoint (demo in 7 days).

