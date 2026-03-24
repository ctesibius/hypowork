import { Module } from "@nestjs/common";
import type { Db } from "@paperclipai/db";
import { DB, DbModule } from "../db/db.module.js";
import { PlcController } from "./plc.controller.js";
import { PlcService } from "./plc.service.js";

@Module({
  imports: [DbModule],
  controllers: [PlcController],
  providers: [
    {
      provide: PlcService,
      useFactory: (db: Db) => new PlcService(db),
      inject: [DB],
    },
  ],
  exports: [PlcService],
})
export class PlcModule {}
