export const type = "codex_local";
export const label = "Codex (local)";
export const DEFAULT_CODEX_LOCAL_MODEL = "gpt-5.3-codex";
export const DEFAULT_CODEX_LOCAL_BYPASS_APPROVALS_AND_SANDBOX = true;

export const models = [
  { id: "gpt-5.4", label: "gpt-5.4" },
  { id: DEFAULT_CODEX_LOCAL_MODEL, label: DEFAULT_CODEX_LOCAL_MODEL },
  { id: "gpt-5.3-codex-spark", label: "gpt-5.3-codex-spark" },
  { id: "gpt-5", label: "gpt-5" },
  { id: "o3", label: "o3" },
  { id: "o4-mini", label: "o4-mini" },
  { id: "gpt-5-mini", label: "gpt-5-mini" },
  { id: "gpt-5-nano", label: "gpt-5-nano" },
  { id: "o3-mini", label: "o3-mini" },
  { id: "codex-mini-latest", label: "Codex Mini" },
];

export const agentConfigurationDoc = `# codex_local agent configuration

Adapter: codex_local

Core fields:
- cwd (string, optional): default absolute working directory fallback for the agent process (created if missing when possible)
- instructionsFilePath (string, optional): absolute path to a markdown instructions file prepended to stdin prompt at runtime
- model (string, optional): Codex model id
- modelReasoningEffort (string, optional): reasoning effort override (minimal|low|medium|high) passed via -c model_reasoning_effort=...
- promptTemplate (string, optional): run prompt template
- search (boolean, optional): run codex with --search
- dangerouslyBypassApprovalsAndSandbox (boolean, optional): run with bypass flag
- command (string, optional): defaults to "codex"
- extraArgs (string[], optional): additional CLI args
- env (object, optional): KEY=VALUE environment variables
- workspaceStrategy (object, optional): execution workspace strategy; currently supports { type: "git_worktree", baseRef?, branchTemplate?, worktreeParentDir? }
- workspaceRuntime (object, optional): workspace runtime service intents; local host-managed services are realized before Codex starts and exposed back via context/env

Operational fields:
- timeoutSec (number, optional): run timeout in seconds
- graceSec (number, optional): SIGTERM grace period in seconds

Notes:
- Prompts are piped via stdin (Codex receives "-" prompt argument).
- Hypowork auto-injects Paperclip skills from the resolved skills root into "$CODEX_HOME/skills" (or "~/.codex/skills") so Codex can discover them. On the server, set \`PAPERCLIP_SKILLS_DIR\` to your deployed \`hypowork/skills\` absolute path (same as Claude adapter).
- Codex also loads USER skills from \`$HOME/.agents/skills\` and REPO skills from \`.agents/skills\` (see OpenAI Codex skills docs). That is separate from \`server/skills/*.md\` (DB seeding) and \`hypowork/skills/\` (Paperclip bundles). To silence errors from broken personal skills, set env \`PAPERCLIP_CODEX_ISOLATE_AGENTS_SKILLS=1\` on the Hypowork server or in adapter \`env\` so runs use a temp HOME with an empty user skills dir (auth still uses \`CODEX_HOME\`). Fix or disable individual skills in \`~/.codex/config.toml\` [[skills.config]] if you prefer not to isolate.
- Some model/tool combinations reject certain effort levels (for example minimal with web search enabled).
- When Hypowork realizes a workspace/runtime for a run, it injects PAPERCLIP_WORKSPACE_* and PAPERCLIP_RUNTIME_* env vars for agent-side tooling.
`;
