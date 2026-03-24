import { Module } from "@nestjs/common";
import type { Db } from "@paperclipai/db";
import { DB, DbModule } from "../db/db.module.js";
import { ConfigModule } from "../config/config.module.js";
import { ConfigService } from "../config/config.service.js";
import { SoftwareFactoryController } from "./software-factory.controller.js";
import { SoftwareFactoryService } from "./software-factory.service.js";

@Module({
  imports: [DbModule, ConfigModule],
  controllers: [SoftwareFactoryController],
  providers: [
    {
      provide: SoftwareFactoryService,
      useFactory: (db: Db, configService: ConfigService) =>
        new SoftwareFactoryService(db, configService),
      inject: [DB, ConfigService],
    },
  ],
  exports: [SoftwareFactoryService],
})
export class SoftwareFactoryModule {}
