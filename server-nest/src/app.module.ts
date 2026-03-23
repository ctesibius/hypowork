import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { ConfigModule } from "./config/config.module.js";
import { DbModule } from "./db/db.module.js";
import { HealthModule } from "./health/health.module.js";
import { AuthModule } from "./auth/auth.module.js";
import { ActorMiddleware } from "./auth/actor.middleware.js";
import { BetterAuthMiddleware } from "./auth/better-auth.middleware.js";
import { BoardMutationMiddleware } from "./auth/board-mutation.middleware.js";
import { PluginApiDelegateMiddleware } from "./plugins/plugin-api-delegate.middleware.js";
import { HeartbeatModule } from "./heartbeat/heartbeat.module.js";
import { CompaniesModule } from "./companies/companies.module.js";
import { AgentsModule } from "./agents/agents.module.js";
import { ProjectsModule } from "./projects/projects.module.js";
import { IssuesModule } from "./issues/issues.module.js";
import { GoalsModule } from "./goals/goals.module.js";
import { DashboardModule } from "./dashboard/dashboard.module.js";
import { SidebarBadgesModule } from "./sidebar-badges/sidebar-badges.module.js";
import { ActivityModule } from "./activity/activity.module.js";
import { InstanceSettingsModule } from "./instance-settings/instance-settings.module.js";
import { CostsModule } from "./costs/costs.module.js";
import { SecretsModule } from "./secrets/secrets.module.js";
import { LlmsModule } from "./llms/llms.module.js";
import { ApprovalsModule } from "./approvals/approvals.module.js";
import { ExecutionWorkspacesModule } from "./execution-workspaces/execution-workspaces.module.js";
import { AssetsModule } from "./assets/assets.module.js";
import { AccessModule } from "./access/access.module.js";
import { DocumentsModule } from "./documents/documents.module.js";
import { CanvasesModule } from "./canvases/canvases.module.js";
import { MemoryModule } from "./memory/memory.module.js";
import { VaultModule } from "./vault/vault.module.js";
import { ChatModule } from "./chat/chat.module.js";
import { LearnerModule } from "./learner/learner.module.js";
import { DocumentModeModule } from "./document-mode/document-mode.module.js";
import { NotesViewerModule } from "./notes-viewer/notes-viewer.module.js";

@Module({
  imports: [
    ConfigModule,
    DbModule,
    HealthModule,
    AuthModule,
    HeartbeatModule,
    CompaniesModule,
    AgentsModule,
    ProjectsModule,
    IssuesModule,
    GoalsModule,
    DashboardModule,
    SidebarBadgesModule,
    ActivityModule,
    InstanceSettingsModule,
    CostsModule,
    SecretsModule,
    LlmsModule,
    ApprovalsModule,
    ExecutionWorkspacesModule,
    AssetsModule,
    AccessModule,
    DocumentsModule,
    CanvasesModule,
    MemoryModule,
    VaultModule,
    ChatModule,
    LearnerModule,
    DocumentModeModule,
    NotesViewerModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(ActorMiddleware).forRoutes("*");
    consumer.apply(BetterAuthMiddleware).forRoutes("*");
    consumer.apply(BoardMutationMiddleware).forRoutes("*");
    consumer.apply(PluginApiDelegateMiddleware).forRoutes("*");
  }
}
