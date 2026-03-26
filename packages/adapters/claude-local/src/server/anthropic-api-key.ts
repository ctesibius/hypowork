/**
 * Agent env may contain placeholders. Direct Anthropic keys usually look like
 * sk-ant-api03-…. Third-party Anthropic-compatible APIs (e.g. MiniMax) use
 * their own secrets and expect ANTHROPIC_BASE_URL — see
 * https://platform.minimax.io/docs/api-reference/text-anthropic-api
 */
export function hasAnthropicCompatibleBaseUrl(
  envConfig: Record<string, unknown>,
  hostEnv: NodeJS.ProcessEnv,
): boolean {
  const fromConfig =
    typeof envConfig.ANTHROPIC_BASE_URL === "string" ? envConfig.ANTHROPIC_BASE_URL.trim() : "";
  const fromHost =
    typeof hostEnv.ANTHROPIC_BASE_URL === "string" ? hostEnv.ANTHROPIC_BASE_URL.trim() : "";
  return fromConfig.length > 0 || fromHost.length > 0;
}

/** Whether to pass ANTHROPIC_API_KEY from adapter env into the Claude child process. */
export function shouldAcceptAnthropicApiKeyFromConfig(
  raw: string,
  envConfig: Record<string, unknown>,
  hostEnv: NodeJS.ProcessEnv,
): boolean {
  const v = raw.trim().replace(/^Bearer\s+/i, "").trim();
  if (v.length < 4) return false;
  if (hasAnthropicCompatibleBaseUrl(envConfig, hostEnv)) return true;
  if (v.length < 16) return false;
  if (v.startsWith("sk-ant-") && v.length >= 32) return true;
  return v.length >= 48;
}
