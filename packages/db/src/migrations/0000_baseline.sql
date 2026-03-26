CREATE TABLE "activity_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"actor_type" text DEFAULT 'system' NOT NULL,
	"actor_id" text NOT NULL,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"agent_id" uuid,
	"run_id" uuid,
	"details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"key_hash" text NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_config_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"created_by_agent_id" uuid,
	"created_by_user_id" text,
	"source" text DEFAULT 'patch' NOT NULL,
	"rolled_back_from_revision_id" uuid,
	"changed_keys" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"before_config" jsonb NOT NULL,
	"after_config" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_runtime_state" (
	"agent_id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"adapter_type" text NOT NULL,
	"session_id" text,
	"state_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_run_id" uuid,
	"last_run_status" text,
	"total_input_tokens" bigint DEFAULT 0 NOT NULL,
	"total_output_tokens" bigint DEFAULT 0 NOT NULL,
	"total_cached_input_tokens" bigint DEFAULT 0 NOT NULL,
	"total_cost_cents" bigint DEFAULT 0 NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_task_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"adapter_type" text NOT NULL,
	"task_key" text NOT NULL,
	"session_params_json" jsonb,
	"session_display_id" text,
	"last_run_id" uuid,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_wakeup_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"source" text NOT NULL,
	"trigger_detail" text,
	"reason" text,
	"payload" jsonb,
	"status" text DEFAULT 'queued' NOT NULL,
	"coalesced_count" integer DEFAULT 0 NOT NULL,
	"requested_by_actor_type" text,
	"requested_by_actor_id" text,
	"idempotency_key" text,
	"run_id" uuid,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"claimed_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"role" text DEFAULT 'general' NOT NULL,
	"title" text,
	"icon" text,
	"status" text DEFAULT 'idle' NOT NULL,
	"reports_to" uuid,
	"capabilities" text,
	"adapter_type" text DEFAULT 'process' NOT NULL,
	"adapter_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"runtime_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"budget_monthly_cents" integer DEFAULT 0 NOT NULL,
	"spent_monthly_cents" integer DEFAULT 0 NOT NULL,
	"pause_reason" text,
	"paused_at" timestamp with time zone,
	"permissions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_heartbeat_at" timestamp with time zone,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "approval_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"approval_id" uuid NOT NULL,
	"author_agent_id" uuid,
	"author_user_id" text,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"type" text NOT NULL,
	"requested_by_agent_id" uuid,
	"requested_by_user_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"payload" jsonb NOT NULL,
	"decision_note" text,
	"decided_by_user_id" text,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"object_key" text NOT NULL,
	"content_type" text NOT NULL,
	"byte_size" integer NOT NULL,
	"sha256" text NOT NULL,
	"original_filename" text,
	"created_by_agent_id" uuid,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "budget_incidents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"policy_id" uuid NOT NULL,
	"scope_type" text NOT NULL,
	"scope_id" uuid NOT NULL,
	"metric" text NOT NULL,
	"window_kind" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"window_end" timestamp with time zone NOT NULL,
	"threshold_type" text NOT NULL,
	"amount_limit" integer NOT NULL,
	"amount_observed" integer NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"approval_id" uuid,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "budget_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"scope_type" text NOT NULL,
	"scope_id" uuid NOT NULL,
	"metric" text DEFAULT 'billed_cents' NOT NULL,
	"window_kind" text NOT NULL,
	"amount" integer DEFAULT 0 NOT NULL,
	"warn_percent" integer DEFAULT 80 NOT NULL,
	"hard_stop_enabled" boolean DEFAULT true NOT NULL,
	"notify_enabled" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by_user_id" text,
	"updated_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "canvas_elements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"type" text NOT NULL,
	"x" integer DEFAULT 0 NOT NULL,
	"y" integer DEFAULT 0 NOT NULL,
	"width" integer,
	"height" integer,
	"z_index" integer DEFAULT 0 NOT NULL,
	"rotation" integer DEFAULT 0 NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_private" boolean DEFAULT false NOT NULL,
	"parent_id" uuid,
	"source_document_id" uuid,
	"selected" boolean DEFAULT false NOT NULL,
	"created_by_agent_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "canvas_viewports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"user_id" text,
	"pan_x" integer DEFAULT 0 NOT NULL,
	"pan_y" integer DEFAULT 0 NOT NULL,
	"zoom" integer DEFAULT 100 NOT NULL,
	"locked_to_element_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"pause_reason" text,
	"paused_at" timestamp with time zone,
	"issue_prefix" text DEFAULT 'PAP' NOT NULL,
	"issue_counter" integer DEFAULT 0 NOT NULL,
	"budget_monthly_cents" integer DEFAULT 0 NOT NULL,
	"spent_monthly_cents" integer DEFAULT 0 NOT NULL,
	"require_board_approval_for_new_agents" boolean DEFAULT true NOT NULL,
	"brand_color" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_canvases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"nodes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"edges" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_logos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"principal_type" text NOT NULL,
	"principal_id" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"membership_role" text,
	"reports_to" text,
	"human_title" text,
	"human_role" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_secret_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"secret_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"material" jsonb NOT NULL,
	"value_sha256" text NOT NULL,
	"created_by_agent_id" uuid,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "workspace_secrets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"provider" text DEFAULT 'local_encrypted' NOT NULL,
	"external_ref" text,
	"latest_version" integer DEFAULT 1 NOT NULL,
	"description" text,
	"created_by_agent_id" uuid,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cost_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"issue_id" uuid,
	"project_id" uuid,
	"goal_id" uuid,
	"heartbeat_run_id" uuid,
	"billing_code" text,
	"provider" text NOT NULL,
	"biller" text DEFAULT 'unknown' NOT NULL,
	"billing_type" text DEFAULT 'unknown' NOT NULL,
	"model" text NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"cached_input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"cost_cents" integer NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"source_document_id" uuid NOT NULL,
	"target_document_id" uuid,
	"raw_reference" text NOT NULL,
	"link_kind" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"revision_number" integer NOT NULL,
	"body" text NOT NULL,
	"canvas_graph_json" text,
	"change_summary" text,
	"created_by_agent_id" uuid,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid,
	"title" text,
	"format" text DEFAULT 'markdown' NOT NULL,
	"kind" text DEFAULT 'prose' NOT NULL,
	"latest_body" text NOT NULL,
	"canvas_graph_json" text,
	"latest_revision_id" uuid,
	"latest_revision_number" integer DEFAULT 1 NOT NULL,
	"created_by_agent_id" uuid,
	"created_by_user_id" text,
	"updated_by_agent_id" uuid,
	"updated_by_user_id" text,
	"plc_template_id" uuid,
	"plc_override" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "execution_workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"project_workspace_id" uuid,
	"source_issue_id" uuid,
	"mode" text NOT NULL,
	"strategy_type" text NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"cwd" text,
	"repo_url" text,
	"base_ref" text,
	"branch_name" text,
	"provider_type" text DEFAULT 'local_fs' NOT NULL,
	"provider_ref" text,
	"derived_from_execution_workspace_id" uuid,
	"last_used_at" timestamp with time zone DEFAULT now() NOT NULL,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	"cleanup_eligible_at" timestamp with time zone,
	"cleanup_reason" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "finance_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"agent_id" uuid,
	"issue_id" uuid,
	"project_id" uuid,
	"goal_id" uuid,
	"heartbeat_run_id" uuid,
	"cost_event_id" uuid,
	"billing_code" text,
	"description" text,
	"event_kind" text NOT NULL,
	"direction" text DEFAULT 'debit' NOT NULL,
	"biller" text NOT NULL,
	"provider" text,
	"execution_adapter_type" text,
	"pricing_tier" text,
	"region" text,
	"model" text,
	"quantity" integer,
	"unit" text,
	"amount_cents" integer NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"estimated" boolean DEFAULT false NOT NULL,
	"external_invoice_id" text,
	"metadata_json" jsonb,
	"occurred_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "global_skills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"skill_name" text NOT NULL,
	"display_name" text,
	"description" text,
	"file_path" text NOT NULL,
	"content_hash" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "global_skills_skill_name_unique" UNIQUE("skill_name")
);
--> statement-breakpoint
CREATE TABLE "goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"level" text DEFAULT 'task' NOT NULL,
	"status" text DEFAULT 'planned' NOT NULL,
	"parent_id" uuid,
	"owner_agent_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "heartbeat_run_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"run_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"seq" integer NOT NULL,
	"event_type" text NOT NULL,
	"stream" text,
	"level" text,
	"color" text,
	"message" text,
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "heartbeat_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"invocation_source" text DEFAULT 'on_demand' NOT NULL,
	"trigger_detail" text,
	"status" text DEFAULT 'queued' NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"error" text,
	"wakeup_request_id" uuid,
	"exit_code" integer,
	"signal" text,
	"usage_json" jsonb,
	"result_json" jsonb,
	"session_id_before" text,
	"session_id_after" text,
	"log_store" text,
	"log_ref" text,
	"log_bytes" bigint,
	"log_sha256" text,
	"log_compressed" boolean DEFAULT false NOT NULL,
	"stdout_excerpt" text,
	"stderr_excerpt" text,
	"error_code" text,
	"external_run_id" text,
	"context_snapshot" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "instance_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"singleton_key" text DEFAULT 'default' NOT NULL,
	"experimental" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "instance_user_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'instance_admin' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"invite_type" text DEFAULT 'company_join' NOT NULL,
	"token_hash" text NOT NULL,
	"allowed_join_types" text DEFAULT 'both' NOT NULL,
	"defaults_payload" jsonb,
	"expires_at" timestamp with time zone NOT NULL,
	"invited_by_user_id" text,
	"revoked_at" timestamp with time zone,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "issue_approvals" (
	"workspace_id" uuid NOT NULL,
	"issue_id" uuid NOT NULL,
	"approval_id" uuid NOT NULL,
	"linked_by_agent_id" uuid,
	"linked_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "issue_approvals_pk" PRIMARY KEY("issue_id","approval_id")
);
--> statement-breakpoint
CREATE TABLE "issue_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"issue_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"issue_comment_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "issue_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"issue_id" uuid NOT NULL,
	"author_agent_id" uuid,
	"author_user_id" text,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "issue_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"issue_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "issue_labels" (
	"issue_id" uuid NOT NULL,
	"label_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "issue_labels_pk" PRIMARY KEY("issue_id","label_id")
);
--> statement-breakpoint
CREATE TABLE "issue_read_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"issue_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"last_read_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "issue_work_products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid,
	"issue_id" uuid NOT NULL,
	"execution_workspace_id" uuid,
	"runtime_service_id" uuid,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"external_id" text,
	"title" text NOT NULL,
	"url" text,
	"status" text NOT NULL,
	"review_state" text DEFAULT 'none' NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"health_status" text DEFAULT 'unknown' NOT NULL,
	"summary" text,
	"metadata" jsonb,
	"created_by_run_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "issues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid,
	"project_workspace_id" uuid,
	"goal_id" uuid,
	"parent_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'backlog' NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"assignee_agent_id" uuid,
	"assignee_user_id" text,
	"checkout_run_id" uuid,
	"execution_run_id" uuid,
	"execution_agent_name_key" text,
	"execution_locked_at" timestamp with time zone,
	"created_by_agent_id" uuid,
	"created_by_user_id" text,
	"issue_number" integer,
	"identifier" text,
	"request_depth" integer DEFAULT 0 NOT NULL,
	"billing_code" text,
	"assignee_adapter_overrides" jsonb,
	"execution_workspace_id" uuid,
	"execution_workspace_preference" text,
	"execution_workspace_settings" jsonb,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"hidden_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "join_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invite_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"request_type" text NOT NULL,
	"status" text DEFAULT 'pending_approval' NOT NULL,
	"request_ip" text NOT NULL,
	"requesting_user_id" text,
	"request_email_snapshot" text,
	"agent_name" text,
	"adapter_type" text,
	"capabilities" text,
	"agent_defaults_payload" jsonb,
	"claim_secret_hash" text,
	"claim_secret_expires_at" timestamp with time zone,
	"claim_secret_consumed_at" timestamp with time zone,
	"created_agent_id" uuid,
	"approved_by_user_id" text,
	"approved_at" timestamp with time zone,
	"rejected_by_user_id" text,
	"rejected_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "labels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"color" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_ratings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"message_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"rating" integer,
	"thumbs_up" boolean,
	"feedback_text" text,
	"aspect" text,
	"prompt_version_id" uuid,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plc_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"stages" jsonb DEFAULT '{"nodes":[],"edges":[]}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plugin_workspace_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"plugin_id" uuid NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"settings_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plugin_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plugin_id" uuid NOT NULL,
	"config_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plugin_entities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plugin_id" uuid NOT NULL,
	"entity_type" text NOT NULL,
	"scope_kind" text NOT NULL,
	"scope_id" text,
	"external_id" text,
	"title" text,
	"status" text,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plugin_job_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"plugin_id" uuid NOT NULL,
	"trigger" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"duration_ms" integer,
	"error" text,
	"logs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plugin_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plugin_id" uuid NOT NULL,
	"job_key" text NOT NULL,
	"schedule" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"last_run_at" timestamp with time zone,
	"next_run_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plugin_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plugin_id" uuid NOT NULL,
	"level" text DEFAULT 'info' NOT NULL,
	"message" text NOT NULL,
	"meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plugin_state" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plugin_id" uuid NOT NULL,
	"scope_kind" text NOT NULL,
	"scope_id" text,
	"namespace" text DEFAULT 'default' NOT NULL,
	"state_key" text NOT NULL,
	"value_json" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plugin_state_unique_entry_idx" UNIQUE NULLS NOT DISTINCT("plugin_id","scope_kind","scope_id","namespace","state_key")
);
--> statement-breakpoint
CREATE TABLE "plugin_webhook_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plugin_id" uuid NOT NULL,
	"webhook_key" text NOT NULL,
	"external_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"duration_ms" integer,
	"error" text,
	"payload" jsonb NOT NULL,
	"headers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plugins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plugin_key" text NOT NULL,
	"package_name" text NOT NULL,
	"version" text NOT NULL,
	"api_version" integer DEFAULT 1 NOT NULL,
	"categories" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"manifest_json" jsonb NOT NULL,
	"status" text DEFAULT 'installed' NOT NULL,
	"install_order" integer,
	"package_path" text,
	"last_error" text,
	"installed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"kind" text DEFAULT 'general' NOT NULL,
	"lead_agent_id" uuid,
	"status" text DEFAULT 'active' NOT NULL,
	"pause_reason" text,
	"paused_at" timestamp with time zone,
	"last_active_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "principal_permission_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"principal_type" text NOT NULL,
	"principal_id" text NOT NULL,
	"permission_key" text NOT NULL,
	"scope" jsonb,
	"granted_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_goals" (
	"project_id" uuid NOT NULL,
	"goal_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_goals_project_id_goal_id_pk" PRIMARY KEY("project_id","goal_id")
);
--> statement-breakpoint
CREATE TABLE "project_workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"source_type" text DEFAULT 'local_path' NOT NULL,
	"cwd" text,
	"repo_url" text,
	"repo_ref" text,
	"default_ref" text,
	"visibility" text DEFAULT 'default' NOT NULL,
	"setup_command" text,
	"cleanup_command" text,
	"remote_provider" text,
	"remote_workspace_ref" text,
	"shared_workspace_key" text,
	"metadata" jsonb,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"goal_id" uuid,
	"name" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'backlog' NOT NULL,
	"lead_agent_id" uuid,
	"created_by_agent_id" uuid,
	"created_by_user_id" text,
	"target_date" date,
	"color" text,
	"pause_reason" text,
	"paused_at" timestamp with time zone,
	"execution_workspace_policy" jsonb,
	"archived_at" timestamp with time zone,
	"planning_canvas_document_id" uuid,
	"plc_template_id" uuid,
	"factory_template" text DEFAULT 'software' NOT NULL,
	"software_factory_lead_agent_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prompt_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"skill_name" text NOT NULL,
	"version" integer NOT NULL,
	"content" text NOT NULL,
	"parent_id" uuid,
	"status" text DEFAULT 'candidate' NOT NULL,
	"metrics" jsonb DEFAULT '{"avgRating":0,"responseCount":0,"thumbsUpRate":0,"improvementOverParent":0,"automatedSuccessRate":0,"efficiencyScore":0,"compositeScore":0}'::jsonb,
	"mutation_type" text,
	"mutation_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"evaluated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "software_factory_blueprints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"title" text NOT NULL,
	"body_md" text DEFAULT '' NOT NULL,
	"diagram_mermaid" text,
	"linked_requirement_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "software_factory_requirements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"title" text NOT NULL,
	"body_md" text DEFAULT '' NOT NULL,
	"structured_yaml" text,
	"version" integer DEFAULT 1 NOT NULL,
	"supersedes_id" uuid,
	"embeddings" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "software_factory_validation_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"source" text NOT NULL,
	"raw_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"summary" text,
	"created_work_order_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "software_factory_work_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description_md" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'todo' NOT NULL,
	"assignee_agent_id" uuid,
	"assigned_user_id" text,
	"depends_on_work_order_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"linked_blueprint_id" uuid,
	"linked_issue_id" uuid,
	"planned_start_at" timestamp with time zone,
	"planned_end_at" timestamp with time zone,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"plc_stage_id" text,
	"plc_template_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_outcomes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"task_id" uuid,
	"task_type" text NOT NULL,
	"prompt_version_id" uuid,
	"success" boolean DEFAULT false NOT NULL,
	"criteria_met" boolean DEFAULT false NOT NULL,
	"error_occurred" boolean DEFAULT false NOT NULL,
	"error_type" text,
	"duration_ms" integer,
	"budget_used_cents" integer,
	"complexity_estimated" integer,
	"complexity_actual" integer,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_operations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"execution_workspace_id" uuid,
	"heartbeat_run_id" uuid,
	"phase" text NOT NULL,
	"command" text,
	"cwd" text,
	"status" text DEFAULT 'running' NOT NULL,
	"exit_code" integer,
	"log_store" text,
	"log_ref" text,
	"log_bytes" bigint,
	"log_sha256" text,
	"log_compressed" boolean DEFAULT false NOT NULL,
	"stdout_excerpt" text,
	"stderr_excerpt" text,
	"metadata" jsonb,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_runtime_services" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid,
	"project_workspace_id" uuid,
	"execution_workspace_id" uuid,
	"issue_id" uuid,
	"scope_type" text NOT NULL,
	"scope_id" text,
	"service_name" text NOT NULL,
	"status" text NOT NULL,
	"lifecycle" text NOT NULL,
	"reuse_key" text,
	"command" text,
	"cwd" text,
	"port" integer,
	"url" text,
	"provider" text NOT NULL,
	"provider_ref" text,
	"owner_agent_id" uuid,
	"started_by_run_id" uuid,
	"last_used_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"stopped_at" timestamp with time zone,
	"stop_policy" jsonb,
	"health_status" text DEFAULT 'unknown' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_run_id_heartbeat_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."heartbeat_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_api_keys" ADD CONSTRAINT "agent_api_keys_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_api_keys" ADD CONSTRAINT "agent_api_keys_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_config_revisions" ADD CONSTRAINT "agent_config_revisions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_config_revisions" ADD CONSTRAINT "agent_config_revisions_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_config_revisions" ADD CONSTRAINT "agent_config_revisions_created_by_agent_id_agents_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_runtime_state" ADD CONSTRAINT "agent_runtime_state_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_runtime_state" ADD CONSTRAINT "agent_runtime_state_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_task_sessions" ADD CONSTRAINT "agent_task_sessions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_task_sessions" ADD CONSTRAINT "agent_task_sessions_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_task_sessions" ADD CONSTRAINT "agent_task_sessions_last_run_id_heartbeat_runs_id_fk" FOREIGN KEY ("last_run_id") REFERENCES "public"."heartbeat_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_wakeup_requests" ADD CONSTRAINT "agent_wakeup_requests_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_wakeup_requests" ADD CONSTRAINT "agent_wakeup_requests_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_reports_to_agents_id_fk" FOREIGN KEY ("reports_to") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_comments" ADD CONSTRAINT "approval_comments_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_comments" ADD CONSTRAINT "approval_comments_approval_id_approvals_id_fk" FOREIGN KEY ("approval_id") REFERENCES "public"."approvals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_comments" ADD CONSTRAINT "approval_comments_author_agent_id_agents_id_fk" FOREIGN KEY ("author_agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_requested_by_agent_id_agents_id_fk" FOREIGN KEY ("requested_by_agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_created_by_agent_id_agents_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_incidents" ADD CONSTRAINT "budget_incidents_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_incidents" ADD CONSTRAINT "budget_incidents_policy_id_budget_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."budget_policies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_incidents" ADD CONSTRAINT "budget_incidents_approval_id_approvals_id_fk" FOREIGN KEY ("approval_id") REFERENCES "public"."approvals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_policies" ADD CONSTRAINT "budget_policies_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "canvas_elements" ADD CONSTRAINT "canvas_elements_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "canvas_elements" ADD CONSTRAINT "canvas_elements_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "canvas_elements" ADD CONSTRAINT "canvas_elements_source_document_id_documents_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "canvas_viewports" ADD CONSTRAINT "canvas_viewports_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "canvas_viewports" ADD CONSTRAINT "canvas_viewports_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_canvases" ADD CONSTRAINT "workspace_canvases_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_logos" ADD CONSTRAINT "workspace_logos_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_logos" ADD CONSTRAINT "workspace_logos_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_memberships" ADD CONSTRAINT "workspace_memberships_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_secret_versions" ADD CONSTRAINT "workspace_secret_versions_secret_id_workspace_secrets_id_fk" FOREIGN KEY ("secret_id") REFERENCES "public"."workspace_secrets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_secret_versions" ADD CONSTRAINT "workspace_secret_versions_created_by_agent_id_agents_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_secrets" ADD CONSTRAINT "workspace_secrets_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_secrets" ADD CONSTRAINT "workspace_secrets_created_by_agent_id_agents_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_events" ADD CONSTRAINT "cost_events_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_events" ADD CONSTRAINT "cost_events_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_events" ADD CONSTRAINT "cost_events_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_events" ADD CONSTRAINT "cost_events_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_events" ADD CONSTRAINT "cost_events_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_events" ADD CONSTRAINT "cost_events_heartbeat_run_id_heartbeat_runs_id_fk" FOREIGN KEY ("heartbeat_run_id") REFERENCES "public"."heartbeat_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_links" ADD CONSTRAINT "document_links_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_links" ADD CONSTRAINT "document_links_source_document_id_documents_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_links" ADD CONSTRAINT "document_links_target_document_id_documents_id_fk" FOREIGN KEY ("target_document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_revisions" ADD CONSTRAINT "document_revisions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_revisions" ADD CONSTRAINT "document_revisions_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_revisions" ADD CONSTRAINT "document_revisions_created_by_agent_id_agents_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_created_by_agent_id_agents_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_updated_by_agent_id_agents_id_fk" FOREIGN KEY ("updated_by_agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "execution_workspaces" ADD CONSTRAINT "execution_workspaces_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "execution_workspaces" ADD CONSTRAINT "execution_workspaces_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "execution_workspaces" ADD CONSTRAINT "execution_workspaces_project_workspace_id_project_workspaces_id_fk" FOREIGN KEY ("project_workspace_id") REFERENCES "public"."project_workspaces"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "execution_workspaces" ADD CONSTRAINT "execution_workspaces_source_issue_id_issues_id_fk" FOREIGN KEY ("source_issue_id") REFERENCES "public"."issues"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "execution_workspaces" ADD CONSTRAINT "execution_workspaces_derived_from_execution_workspace_id_execution_workspaces_id_fk" FOREIGN KEY ("derived_from_execution_workspace_id") REFERENCES "public"."execution_workspaces"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_events" ADD CONSTRAINT "finance_events_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_events" ADD CONSTRAINT "finance_events_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_events" ADD CONSTRAINT "finance_events_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_events" ADD CONSTRAINT "finance_events_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_events" ADD CONSTRAINT "finance_events_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_events" ADD CONSTRAINT "finance_events_heartbeat_run_id_heartbeat_runs_id_fk" FOREIGN KEY ("heartbeat_run_id") REFERENCES "public"."heartbeat_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_events" ADD CONSTRAINT "finance_events_cost_event_id_cost_events_id_fk" FOREIGN KEY ("cost_event_id") REFERENCES "public"."cost_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_parent_id_goals_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."goals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_owner_agent_id_agents_id_fk" FOREIGN KEY ("owner_agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "heartbeat_run_events" ADD CONSTRAINT "heartbeat_run_events_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "heartbeat_run_events" ADD CONSTRAINT "heartbeat_run_events_run_id_heartbeat_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."heartbeat_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "heartbeat_run_events" ADD CONSTRAINT "heartbeat_run_events_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "heartbeat_runs" ADD CONSTRAINT "heartbeat_runs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "heartbeat_runs" ADD CONSTRAINT "heartbeat_runs_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "heartbeat_runs" ADD CONSTRAINT "heartbeat_runs_wakeup_request_id_agent_wakeup_requests_id_fk" FOREIGN KEY ("wakeup_request_id") REFERENCES "public"."agent_wakeup_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_approvals" ADD CONSTRAINT "issue_approvals_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_approvals" ADD CONSTRAINT "issue_approvals_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_approvals" ADD CONSTRAINT "issue_approvals_approval_id_approvals_id_fk" FOREIGN KEY ("approval_id") REFERENCES "public"."approvals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_approvals" ADD CONSTRAINT "issue_approvals_linked_by_agent_id_agents_id_fk" FOREIGN KEY ("linked_by_agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_attachments" ADD CONSTRAINT "issue_attachments_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_attachments" ADD CONSTRAINT "issue_attachments_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_attachments" ADD CONSTRAINT "issue_attachments_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_attachments" ADD CONSTRAINT "issue_attachments_issue_comment_id_issue_comments_id_fk" FOREIGN KEY ("issue_comment_id") REFERENCES "public"."issue_comments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_comments" ADD CONSTRAINT "issue_comments_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_comments" ADD CONSTRAINT "issue_comments_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_comments" ADD CONSTRAINT "issue_comments_author_agent_id_agents_id_fk" FOREIGN KEY ("author_agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_documents" ADD CONSTRAINT "issue_documents_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_documents" ADD CONSTRAINT "issue_documents_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_documents" ADD CONSTRAINT "issue_documents_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_labels" ADD CONSTRAINT "issue_labels_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_labels" ADD CONSTRAINT "issue_labels_label_id_labels_id_fk" FOREIGN KEY ("label_id") REFERENCES "public"."labels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_labels" ADD CONSTRAINT "issue_labels_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_read_states" ADD CONSTRAINT "issue_read_states_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_read_states" ADD CONSTRAINT "issue_read_states_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_work_products" ADD CONSTRAINT "issue_work_products_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_work_products" ADD CONSTRAINT "issue_work_products_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_work_products" ADD CONSTRAINT "issue_work_products_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_work_products" ADD CONSTRAINT "issue_work_products_execution_workspace_id_execution_workspaces_id_fk" FOREIGN KEY ("execution_workspace_id") REFERENCES "public"."execution_workspaces"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_work_products" ADD CONSTRAINT "issue_work_products_runtime_service_id_workspace_runtime_services_id_fk" FOREIGN KEY ("runtime_service_id") REFERENCES "public"."workspace_runtime_services"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_work_products" ADD CONSTRAINT "issue_work_products_created_by_run_id_heartbeat_runs_id_fk" FOREIGN KEY ("created_by_run_id") REFERENCES "public"."heartbeat_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_project_workspace_id_project_workspaces_id_fk" FOREIGN KEY ("project_workspace_id") REFERENCES "public"."project_workspaces"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_parent_id_issues_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."issues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_assignee_agent_id_agents_id_fk" FOREIGN KEY ("assignee_agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_checkout_run_id_heartbeat_runs_id_fk" FOREIGN KEY ("checkout_run_id") REFERENCES "public"."heartbeat_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_execution_run_id_heartbeat_runs_id_fk" FOREIGN KEY ("execution_run_id") REFERENCES "public"."heartbeat_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_created_by_agent_id_agents_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_execution_workspace_id_execution_workspaces_id_fk" FOREIGN KEY ("execution_workspace_id") REFERENCES "public"."execution_workspaces"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "join_requests" ADD CONSTRAINT "join_requests_invite_id_invites_id_fk" FOREIGN KEY ("invite_id") REFERENCES "public"."invites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "join_requests" ADD CONSTRAINT "join_requests_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "join_requests" ADD CONSTRAINT "join_requests_created_agent_id_agents_id_fk" FOREIGN KEY ("created_agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "labels" ADD CONSTRAINT "labels_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_ratings" ADD CONSTRAINT "message_ratings_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_ratings" ADD CONSTRAINT "message_ratings_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plc_templates" ADD CONSTRAINT "plc_templates_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plugin_workspace_settings" ADD CONSTRAINT "plugin_workspace_settings_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plugin_workspace_settings" ADD CONSTRAINT "plugin_workspace_settings_plugin_id_plugins_id_fk" FOREIGN KEY ("plugin_id") REFERENCES "public"."plugins"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plugin_config" ADD CONSTRAINT "plugin_config_plugin_id_plugins_id_fk" FOREIGN KEY ("plugin_id") REFERENCES "public"."plugins"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plugin_entities" ADD CONSTRAINT "plugin_entities_plugin_id_plugins_id_fk" FOREIGN KEY ("plugin_id") REFERENCES "public"."plugins"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plugin_job_runs" ADD CONSTRAINT "plugin_job_runs_job_id_plugin_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."plugin_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plugin_job_runs" ADD CONSTRAINT "plugin_job_runs_plugin_id_plugins_id_fk" FOREIGN KEY ("plugin_id") REFERENCES "public"."plugins"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plugin_jobs" ADD CONSTRAINT "plugin_jobs_plugin_id_plugins_id_fk" FOREIGN KEY ("plugin_id") REFERENCES "public"."plugins"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plugin_logs" ADD CONSTRAINT "plugin_logs_plugin_id_plugins_id_fk" FOREIGN KEY ("plugin_id") REFERENCES "public"."plugins"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plugin_state" ADD CONSTRAINT "plugin_state_plugin_id_plugins_id_fk" FOREIGN KEY ("plugin_id") REFERENCES "public"."plugins"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plugin_webhook_deliveries" ADD CONSTRAINT "plugin_webhook_deliveries_plugin_id_plugins_id_fk" FOREIGN KEY ("plugin_id") REFERENCES "public"."plugins"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pods" ADD CONSTRAINT "pods_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "principal_permission_grants" ADD CONSTRAINT "principal_permission_grants_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_goals" ADD CONSTRAINT "project_goals_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_goals" ADD CONSTRAINT "project_goals_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_goals" ADD CONSTRAINT "project_goals_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_workspaces" ADD CONSTRAINT "project_workspaces_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_workspaces" ADD CONSTRAINT "project_workspaces_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_lead_agent_id_agents_id_fk" FOREIGN KEY ("lead_agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_created_by_agent_id_agents_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_software_factory_lead_agent_id_agents_id_fk" FOREIGN KEY ("software_factory_lead_agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompt_versions" ADD CONSTRAINT "prompt_versions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompt_versions" ADD CONSTRAINT "prompt_versions_parent_id_prompt_versions_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."prompt_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "software_factory_blueprints" ADD CONSTRAINT "software_factory_blueprints_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "software_factory_blueprints" ADD CONSTRAINT "software_factory_blueprints_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "software_factory_requirements" ADD CONSTRAINT "software_factory_requirements_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "software_factory_requirements" ADD CONSTRAINT "software_factory_requirements_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "software_factory_validation_events" ADD CONSTRAINT "software_factory_validation_events_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "software_factory_validation_events" ADD CONSTRAINT "software_factory_validation_events_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "software_factory_work_orders" ADD CONSTRAINT "software_factory_work_orders_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "software_factory_work_orders" ADD CONSTRAINT "software_factory_work_orders_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "software_factory_work_orders" ADD CONSTRAINT "software_factory_work_orders_assignee_agent_id_agents_id_fk" FOREIGN KEY ("assignee_agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "software_factory_work_orders" ADD CONSTRAINT "software_factory_work_orders_linked_issue_id_issues_id_fk" FOREIGN KEY ("linked_issue_id") REFERENCES "public"."issues"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_outcomes" ADD CONSTRAINT "task_outcomes_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_outcomes" ADD CONSTRAINT "task_outcomes_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_operations" ADD CONSTRAINT "workspace_operations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_operations" ADD CONSTRAINT "workspace_operations_execution_workspace_id_execution_workspaces_id_fk" FOREIGN KEY ("execution_workspace_id") REFERENCES "public"."execution_workspaces"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_operations" ADD CONSTRAINT "workspace_operations_heartbeat_run_id_heartbeat_runs_id_fk" FOREIGN KEY ("heartbeat_run_id") REFERENCES "public"."heartbeat_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_runtime_services" ADD CONSTRAINT "workspace_runtime_services_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_runtime_services" ADD CONSTRAINT "workspace_runtime_services_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_runtime_services" ADD CONSTRAINT "workspace_runtime_services_project_workspace_id_project_workspaces_id_fk" FOREIGN KEY ("project_workspace_id") REFERENCES "public"."project_workspaces"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_runtime_services" ADD CONSTRAINT "workspace_runtime_services_execution_workspace_id_execution_workspaces_id_fk" FOREIGN KEY ("execution_workspace_id") REFERENCES "public"."execution_workspaces"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_runtime_services" ADD CONSTRAINT "workspace_runtime_services_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_runtime_services" ADD CONSTRAINT "workspace_runtime_services_owner_agent_id_agents_id_fk" FOREIGN KEY ("owner_agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_runtime_services" ADD CONSTRAINT "workspace_runtime_services_started_by_run_id_heartbeat_runs_id_fk" FOREIGN KEY ("started_by_run_id") REFERENCES "public"."heartbeat_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_log_company_created_idx" ON "activity_log" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "activity_log_run_id_idx" ON "activity_log" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "activity_log_entity_type_id_idx" ON "activity_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "agent_api_keys_key_hash_idx" ON "agent_api_keys" USING btree ("key_hash");--> statement-breakpoint
CREATE INDEX "agent_api_keys_company_agent_idx" ON "agent_api_keys" USING btree ("workspace_id","agent_id");--> statement-breakpoint
CREATE INDEX "agent_config_revisions_company_agent_created_idx" ON "agent_config_revisions" USING btree ("workspace_id","agent_id","created_at");--> statement-breakpoint
CREATE INDEX "agent_config_revisions_agent_created_idx" ON "agent_config_revisions" USING btree ("agent_id","created_at");--> statement-breakpoint
CREATE INDEX "agent_runtime_state_company_agent_idx" ON "agent_runtime_state" USING btree ("workspace_id","agent_id");--> statement-breakpoint
CREATE INDEX "agent_runtime_state_company_updated_idx" ON "agent_runtime_state" USING btree ("workspace_id","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_task_sessions_company_agent_adapter_task_uniq" ON "agent_task_sessions" USING btree ("workspace_id","agent_id","adapter_type","task_key");--> statement-breakpoint
CREATE INDEX "agent_task_sessions_company_agent_updated_idx" ON "agent_task_sessions" USING btree ("workspace_id","agent_id","updated_at");--> statement-breakpoint
CREATE INDEX "agent_task_sessions_company_task_updated_idx" ON "agent_task_sessions" USING btree ("workspace_id","task_key","updated_at");--> statement-breakpoint
CREATE INDEX "agent_wakeup_requests_company_agent_status_idx" ON "agent_wakeup_requests" USING btree ("workspace_id","agent_id","status");--> statement-breakpoint
CREATE INDEX "agent_wakeup_requests_company_requested_idx" ON "agent_wakeup_requests" USING btree ("workspace_id","requested_at");--> statement-breakpoint
CREATE INDEX "agent_wakeup_requests_agent_requested_idx" ON "agent_wakeup_requests" USING btree ("agent_id","requested_at");--> statement-breakpoint
CREATE INDEX "agents_company_status_idx" ON "agents" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "agents_company_reports_to_idx" ON "agents" USING btree ("workspace_id","reports_to");--> statement-breakpoint
CREATE INDEX "approval_comments_company_idx" ON "approval_comments" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "approval_comments_approval_idx" ON "approval_comments" USING btree ("approval_id");--> statement-breakpoint
CREATE INDEX "approval_comments_approval_created_idx" ON "approval_comments" USING btree ("approval_id","created_at");--> statement-breakpoint
CREATE INDEX "approvals_company_status_type_idx" ON "approvals" USING btree ("workspace_id","status","type");--> statement-breakpoint
CREATE INDEX "assets_company_created_idx" ON "assets" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "assets_company_provider_idx" ON "assets" USING btree ("workspace_id","provider");--> statement-breakpoint
CREATE UNIQUE INDEX "assets_company_object_key_uq" ON "assets" USING btree ("workspace_id","object_key");--> statement-breakpoint
CREATE INDEX "budget_incidents_company_status_idx" ON "budget_incidents" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "budget_incidents_company_scope_idx" ON "budget_incidents" USING btree ("workspace_id","scope_type","scope_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "budget_incidents_policy_window_threshold_idx" ON "budget_incidents" USING btree ("policy_id","window_start","threshold_type") WHERE "budget_incidents"."status" <> 'dismissed';--> statement-breakpoint
CREATE INDEX "budget_policies_company_scope_active_idx" ON "budget_policies" USING btree ("workspace_id","scope_type","scope_id","is_active");--> statement-breakpoint
CREATE INDEX "budget_policies_company_window_idx" ON "budget_policies" USING btree ("workspace_id","window_kind","metric");--> statement-breakpoint
CREATE UNIQUE INDEX "budget_policies_company_scope_metric_unique_idx" ON "budget_policies" USING btree ("workspace_id","scope_type","scope_id","metric","window_kind");--> statement-breakpoint
CREATE INDEX "canvas_elements_document_canvas_idx" ON "canvas_elements" USING btree ("document_id","z_index");--> statement-breakpoint
CREATE INDEX "canvas_elements_user_canvas_idx" ON "canvas_elements" USING btree ("document_id","is_private");--> statement-breakpoint
CREATE INDEX "canvas_elements_type_idx" ON "canvas_elements" USING btree ("document_id","type");--> statement-breakpoint
CREATE INDEX "canvas_viewport_unique_idx" ON "canvas_viewports" USING btree ("document_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workspaces_issue_prefix_idx" ON "workspaces" USING btree ("issue_prefix");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_logos_workspace_uq" ON "workspace_logos" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_logos_asset_uq" ON "workspace_logos" USING btree ("asset_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_memberships_workspace_principal_unique_idx" ON "workspace_memberships" USING btree ("workspace_id","principal_type","principal_id");--> statement-breakpoint
CREATE INDEX "workspace_memberships_principal_status_idx" ON "workspace_memberships" USING btree ("principal_type","principal_id","status");--> statement-breakpoint
CREATE INDEX "workspace_memberships_workspace_status_idx" ON "workspace_memberships" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "workspace_secret_versions_secret_idx" ON "workspace_secret_versions" USING btree ("secret_id","created_at");--> statement-breakpoint
CREATE INDEX "workspace_secret_versions_value_sha256_idx" ON "workspace_secret_versions" USING btree ("value_sha256");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_secret_versions_secret_version_uq" ON "workspace_secret_versions" USING btree ("secret_id","version");--> statement-breakpoint
CREATE INDEX "workspace_secrets_workspace_idx" ON "workspace_secrets" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "workspace_secrets_workspace_provider_idx" ON "workspace_secrets" USING btree ("workspace_id","provider");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_secrets_workspace_name_uq" ON "workspace_secrets" USING btree ("workspace_id","name");--> statement-breakpoint
CREATE INDEX "cost_events_company_occurred_idx" ON "cost_events" USING btree ("workspace_id","occurred_at");--> statement-breakpoint
CREATE INDEX "cost_events_company_agent_occurred_idx" ON "cost_events" USING btree ("workspace_id","agent_id","occurred_at");--> statement-breakpoint
CREATE INDEX "cost_events_company_provider_occurred_idx" ON "cost_events" USING btree ("workspace_id","provider","occurred_at");--> statement-breakpoint
CREATE INDEX "cost_events_company_biller_occurred_idx" ON "cost_events" USING btree ("workspace_id","biller","occurred_at");--> statement-breakpoint
CREATE INDEX "cost_events_company_heartbeat_run_idx" ON "cost_events" USING btree ("workspace_id","heartbeat_run_id");--> statement-breakpoint
CREATE INDEX "document_links_source_document_id_idx" ON "document_links" USING btree ("source_document_id");--> statement-breakpoint
CREATE INDEX "document_links_company_target_idx" ON "document_links" USING btree ("workspace_id","target_document_id");--> statement-breakpoint
CREATE INDEX "document_links_company_source_idx" ON "document_links" USING btree ("workspace_id","source_document_id");--> statement-breakpoint
CREATE UNIQUE INDEX "document_revisions_document_revision_uq" ON "document_revisions" USING btree ("document_id","revision_number");--> statement-breakpoint
CREATE INDEX "document_revisions_company_document_created_idx" ON "document_revisions" USING btree ("workspace_id","document_id","created_at");--> statement-breakpoint
CREATE INDEX "documents_company_updated_idx" ON "documents" USING btree ("workspace_id","updated_at");--> statement-breakpoint
CREATE INDEX "documents_company_created_idx" ON "documents" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "documents_company_project_idx" ON "documents" USING btree ("workspace_id","project_id");--> statement-breakpoint
CREATE INDEX "execution_workspaces_company_project_status_idx" ON "execution_workspaces" USING btree ("workspace_id","project_id","status");--> statement-breakpoint
CREATE INDEX "execution_workspaces_company_project_workspace_status_idx" ON "execution_workspaces" USING btree ("workspace_id","project_workspace_id","status");--> statement-breakpoint
CREATE INDEX "execution_workspaces_company_source_issue_idx" ON "execution_workspaces" USING btree ("workspace_id","source_issue_id");--> statement-breakpoint
CREATE INDEX "execution_workspaces_company_last_used_idx" ON "execution_workspaces" USING btree ("workspace_id","last_used_at");--> statement-breakpoint
CREATE INDEX "execution_workspaces_company_branch_idx" ON "execution_workspaces" USING btree ("workspace_id","branch_name");--> statement-breakpoint
CREATE INDEX "finance_events_company_occurred_idx" ON "finance_events" USING btree ("workspace_id","occurred_at");--> statement-breakpoint
CREATE INDEX "finance_events_company_biller_occurred_idx" ON "finance_events" USING btree ("workspace_id","biller","occurred_at");--> statement-breakpoint
CREATE INDEX "finance_events_company_kind_occurred_idx" ON "finance_events" USING btree ("workspace_id","event_kind","occurred_at");--> statement-breakpoint
CREATE INDEX "finance_events_company_direction_occurred_idx" ON "finance_events" USING btree ("workspace_id","direction","occurred_at");--> statement-breakpoint
CREATE INDEX "finance_events_company_heartbeat_run_idx" ON "finance_events" USING btree ("workspace_id","heartbeat_run_id");--> statement-breakpoint
CREATE INDEX "finance_events_company_cost_event_idx" ON "finance_events" USING btree ("workspace_id","cost_event_id");--> statement-breakpoint
CREATE INDEX "global_skills_name_idx" ON "global_skills" USING btree ("skill_name");--> statement-breakpoint
CREATE INDEX "goals_company_idx" ON "goals" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "heartbeat_run_events_run_seq_idx" ON "heartbeat_run_events" USING btree ("run_id","seq");--> statement-breakpoint
CREATE INDEX "heartbeat_run_events_company_run_idx" ON "heartbeat_run_events" USING btree ("workspace_id","run_id");--> statement-breakpoint
CREATE INDEX "heartbeat_run_events_company_created_idx" ON "heartbeat_run_events" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "heartbeat_runs_company_agent_started_idx" ON "heartbeat_runs" USING btree ("workspace_id","agent_id","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "instance_settings_singleton_key_idx" ON "instance_settings" USING btree ("singleton_key");--> statement-breakpoint
CREATE UNIQUE INDEX "instance_user_roles_user_role_unique_idx" ON "instance_user_roles" USING btree ("user_id","role");--> statement-breakpoint
CREATE INDEX "instance_user_roles_role_idx" ON "instance_user_roles" USING btree ("role");--> statement-breakpoint
CREATE UNIQUE INDEX "invites_token_hash_unique_idx" ON "invites" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "invites_company_invite_state_idx" ON "invites" USING btree ("workspace_id","invite_type","revoked_at","expires_at");--> statement-breakpoint
CREATE INDEX "issue_approvals_issue_idx" ON "issue_approvals" USING btree ("issue_id");--> statement-breakpoint
CREATE INDEX "issue_approvals_approval_idx" ON "issue_approvals" USING btree ("approval_id");--> statement-breakpoint
CREATE INDEX "issue_approvals_company_idx" ON "issue_approvals" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "issue_attachments_company_issue_idx" ON "issue_attachments" USING btree ("workspace_id","issue_id");--> statement-breakpoint
CREATE INDEX "issue_attachments_issue_comment_idx" ON "issue_attachments" USING btree ("issue_comment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "issue_attachments_asset_uq" ON "issue_attachments" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "issue_comments_issue_idx" ON "issue_comments" USING btree ("issue_id");--> statement-breakpoint
CREATE INDEX "issue_comments_company_idx" ON "issue_comments" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "issue_comments_company_issue_created_at_idx" ON "issue_comments" USING btree ("workspace_id","issue_id","created_at");--> statement-breakpoint
CREATE INDEX "issue_comments_company_author_issue_created_at_idx" ON "issue_comments" USING btree ("workspace_id","author_user_id","issue_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "issue_documents_company_issue_key_uq" ON "issue_documents" USING btree ("workspace_id","issue_id","key");--> statement-breakpoint
CREATE UNIQUE INDEX "issue_documents_document_uq" ON "issue_documents" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "issue_documents_company_issue_updated_idx" ON "issue_documents" USING btree ("workspace_id","issue_id","updated_at");--> statement-breakpoint
CREATE INDEX "issue_labels_issue_idx" ON "issue_labels" USING btree ("issue_id");--> statement-breakpoint
CREATE INDEX "issue_labels_label_idx" ON "issue_labels" USING btree ("label_id");--> statement-breakpoint
CREATE INDEX "issue_labels_company_idx" ON "issue_labels" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "issue_read_states_company_issue_idx" ON "issue_read_states" USING btree ("workspace_id","issue_id");--> statement-breakpoint
CREATE INDEX "issue_read_states_company_user_idx" ON "issue_read_states" USING btree ("workspace_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "issue_read_states_company_issue_user_idx" ON "issue_read_states" USING btree ("workspace_id","issue_id","user_id");--> statement-breakpoint
CREATE INDEX "issue_work_products_company_issue_type_idx" ON "issue_work_products" USING btree ("workspace_id","issue_id","type");--> statement-breakpoint
CREATE INDEX "issue_work_products_company_execution_workspace_type_idx" ON "issue_work_products" USING btree ("workspace_id","execution_workspace_id","type");--> statement-breakpoint
CREATE INDEX "issue_work_products_company_provider_external_id_idx" ON "issue_work_products" USING btree ("workspace_id","provider","external_id");--> statement-breakpoint
CREATE INDEX "issue_work_products_company_updated_idx" ON "issue_work_products" USING btree ("workspace_id","updated_at");--> statement-breakpoint
CREATE INDEX "issues_company_status_idx" ON "issues" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "issues_company_assignee_status_idx" ON "issues" USING btree ("workspace_id","assignee_agent_id","status");--> statement-breakpoint
CREATE INDEX "issues_company_assignee_user_status_idx" ON "issues" USING btree ("workspace_id","assignee_user_id","status");--> statement-breakpoint
CREATE INDEX "issues_company_parent_idx" ON "issues" USING btree ("workspace_id","parent_id");--> statement-breakpoint
CREATE INDEX "issues_company_project_idx" ON "issues" USING btree ("workspace_id","project_id");--> statement-breakpoint
CREATE INDEX "issues_company_project_workspace_idx" ON "issues" USING btree ("workspace_id","project_workspace_id");--> statement-breakpoint
CREATE INDEX "issues_company_execution_workspace_idx" ON "issues" USING btree ("workspace_id","execution_workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "issues_identifier_idx" ON "issues" USING btree ("identifier");--> statement-breakpoint
CREATE UNIQUE INDEX "join_requests_invite_unique_idx" ON "join_requests" USING btree ("invite_id");--> statement-breakpoint
CREATE INDEX "join_requests_company_status_type_created_idx" ON "join_requests" USING btree ("workspace_id","status","request_type","created_at");--> statement-breakpoint
CREATE INDEX "labels_company_idx" ON "labels" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "labels_company_name_idx" ON "labels" USING btree ("workspace_id","name");--> statement-breakpoint
CREATE INDEX "message_ratings_company_message_idx" ON "message_ratings" USING btree ("workspace_id","message_id");--> statement-breakpoint
CREATE INDEX "message_ratings_prompt_version_idx" ON "message_ratings" USING btree ("prompt_version_id");--> statement-breakpoint
CREATE INDEX "message_ratings_user_idx" ON "message_ratings" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "plc_templates_company_idx" ON "plc_templates" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "plugin_workspace_settings_workspace_idx" ON "plugin_workspace_settings" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "plugin_workspace_settings_plugin_idx" ON "plugin_workspace_settings" USING btree ("plugin_id");--> statement-breakpoint
CREATE UNIQUE INDEX "plugin_workspace_settings_workspace_plugin_uq" ON "plugin_workspace_settings" USING btree ("workspace_id","plugin_id");--> statement-breakpoint
CREATE UNIQUE INDEX "plugin_config_plugin_id_idx" ON "plugin_config" USING btree ("plugin_id");--> statement-breakpoint
CREATE INDEX "plugin_entities_plugin_idx" ON "plugin_entities" USING btree ("plugin_id");--> statement-breakpoint
CREATE INDEX "plugin_entities_type_idx" ON "plugin_entities" USING btree ("entity_type");--> statement-breakpoint
CREATE INDEX "plugin_entities_scope_idx" ON "plugin_entities" USING btree ("scope_kind","scope_id");--> statement-breakpoint
CREATE UNIQUE INDEX "plugin_entities_external_idx" ON "plugin_entities" USING btree ("plugin_id","entity_type","external_id");--> statement-breakpoint
CREATE INDEX "plugin_job_runs_job_idx" ON "plugin_job_runs" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "plugin_job_runs_plugin_idx" ON "plugin_job_runs" USING btree ("plugin_id");--> statement-breakpoint
CREATE INDEX "plugin_job_runs_status_idx" ON "plugin_job_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "plugin_jobs_plugin_idx" ON "plugin_jobs" USING btree ("plugin_id");--> statement-breakpoint
CREATE INDEX "plugin_jobs_next_run_idx" ON "plugin_jobs" USING btree ("next_run_at");--> statement-breakpoint
CREATE UNIQUE INDEX "plugin_jobs_unique_idx" ON "plugin_jobs" USING btree ("plugin_id","job_key");--> statement-breakpoint
CREATE INDEX "plugin_logs_plugin_time_idx" ON "plugin_logs" USING btree ("plugin_id","created_at");--> statement-breakpoint
CREATE INDEX "plugin_logs_level_idx" ON "plugin_logs" USING btree ("level");--> statement-breakpoint
CREATE INDEX "plugin_state_plugin_scope_idx" ON "plugin_state" USING btree ("plugin_id","scope_kind");--> statement-breakpoint
CREATE INDEX "plugin_webhook_deliveries_plugin_idx" ON "plugin_webhook_deliveries" USING btree ("plugin_id");--> statement-breakpoint
CREATE INDEX "plugin_webhook_deliveries_status_idx" ON "plugin_webhook_deliveries" USING btree ("status");--> statement-breakpoint
CREATE INDEX "plugin_webhook_deliveries_key_idx" ON "plugin_webhook_deliveries" USING btree ("webhook_key");--> statement-breakpoint
CREATE UNIQUE INDEX "plugins_plugin_key_idx" ON "plugins" USING btree ("plugin_key");--> statement-breakpoint
CREATE INDEX "plugins_status_idx" ON "plugins" USING btree ("status");--> statement-breakpoint
CREATE INDEX "pods_company_idx" ON "pods" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "pods_company_status_idx" ON "pods" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "pods_lead_agent_idx" ON "pods" USING btree ("lead_agent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "principal_permission_grants_unique_idx" ON "principal_permission_grants" USING btree ("workspace_id","principal_type","principal_id","permission_key");--> statement-breakpoint
CREATE INDEX "principal_permission_grants_company_permission_idx" ON "principal_permission_grants" USING btree ("workspace_id","permission_key");--> statement-breakpoint
CREATE INDEX "project_goals_project_idx" ON "project_goals" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_goals_goal_idx" ON "project_goals" USING btree ("goal_id");--> statement-breakpoint
CREATE INDEX "project_goals_company_idx" ON "project_goals" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "project_workspaces_company_project_idx" ON "project_workspaces" USING btree ("workspace_id","project_id");--> statement-breakpoint
CREATE INDEX "project_workspaces_project_primary_idx" ON "project_workspaces" USING btree ("project_id","is_primary");--> statement-breakpoint
CREATE INDEX "project_workspaces_project_source_type_idx" ON "project_workspaces" USING btree ("project_id","source_type");--> statement-breakpoint
CREATE INDEX "project_workspaces_company_shared_key_idx" ON "project_workspaces" USING btree ("workspace_id","shared_workspace_key");--> statement-breakpoint
CREATE UNIQUE INDEX "project_workspaces_project_remote_ref_idx" ON "project_workspaces" USING btree ("project_id","remote_provider","remote_workspace_ref");--> statement-breakpoint
CREATE INDEX "projects_company_idx" ON "projects" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "prompt_versions_company_skill_idx" ON "prompt_versions" USING btree ("workspace_id","skill_name");--> statement-breakpoint
CREATE INDEX "prompt_versions_status_idx" ON "prompt_versions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "prompt_versions_parent_idx" ON "prompt_versions" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "prompt_versions_company_baseline_idx" ON "prompt_versions" USING btree ("workspace_id","skill_name","status");--> statement-breakpoint
CREATE INDEX "sf_blueprints_company_project_idx" ON "software_factory_blueprints" USING btree ("workspace_id","project_id");--> statement-breakpoint
CREATE INDEX "sf_requirements_company_project_idx" ON "software_factory_requirements" USING btree ("workspace_id","project_id");--> statement-breakpoint
CREATE INDEX "sf_validation_events_company_project_idx" ON "software_factory_validation_events" USING btree ("workspace_id","project_id");--> statement-breakpoint
CREATE INDEX "sf_work_orders_company_project_idx" ON "software_factory_work_orders" USING btree ("workspace_id","project_id");--> statement-breakpoint
CREATE INDEX "task_outcomes_company_agent_idx" ON "task_outcomes" USING btree ("workspace_id","agent_id");--> statement-breakpoint
CREATE INDEX "task_outcomes_task_type_idx" ON "task_outcomes" USING btree ("task_type");--> statement-breakpoint
CREATE INDEX "task_outcomes_success_idx" ON "task_outcomes" USING btree ("success");--> statement-breakpoint
CREATE INDEX "task_outcomes_prompt_version_idx" ON "task_outcomes" USING btree ("prompt_version_id");--> statement-breakpoint
CREATE INDEX "task_outcomes_created_at_idx" ON "task_outcomes" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "workspace_operations_company_run_started_idx" ON "workspace_operations" USING btree ("workspace_id","heartbeat_run_id","started_at");--> statement-breakpoint
CREATE INDEX "workspace_operations_company_workspace_started_idx" ON "workspace_operations" USING btree ("workspace_id","execution_workspace_id","started_at");--> statement-breakpoint
CREATE INDEX "workspace_runtime_services_company_workspace_status_idx" ON "workspace_runtime_services" USING btree ("workspace_id","project_workspace_id","status");--> statement-breakpoint
CREATE INDEX "workspace_runtime_services_company_execution_workspace_status_idx" ON "workspace_runtime_services" USING btree ("workspace_id","execution_workspace_id","status");--> statement-breakpoint
CREATE INDEX "workspace_runtime_services_company_project_status_idx" ON "workspace_runtime_services" USING btree ("workspace_id","project_id","status");--> statement-breakpoint
CREATE INDEX "workspace_runtime_services_run_idx" ON "workspace_runtime_services" USING btree ("started_by_run_id");--> statement-breakpoint
CREATE INDEX "workspace_runtime_services_company_updated_idx" ON "workspace_runtime_services" USING btree ("workspace_id","updated_at");