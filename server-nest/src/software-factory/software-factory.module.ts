import { Module } from "@nestjs/common";
import type { Db } from "@paperclipai/db";
import { DB, DbModule } from "../db/db.module.js";
import { SoftwareFactoryController } from "./software-factory.controller.js";
import { SoftwareFactoryService } from "./software-factory.service.js";

@Module({
  imports: [DbModule],
  controllers: [SoftwareFactoryController],
  providers: [
    {
      provide: SoftwareFactoryService,
      useFactory: (db: Db) => new SoftwareFactoryService(db),
      inject: [DB],
    },
  ],
  exports: [SoftwareFactoryService],
})
export class SoftwareFactoryModule {}
