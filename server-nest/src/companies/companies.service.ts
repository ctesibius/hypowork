import { Inject, Injectable } from "@nestjs/common";
import type { Db } from "@paperclipai/db";
import { companyService as expressCompanyService } from "@paperclipai/server/services/companies";
import { DB } from "../db/db.module.js";

type ExpressCompanyService = ReturnType<typeof expressCompanyService>;

@Injectable()
export class CompaniesService {
  private readonly svc: ExpressCompanyService;

  constructor(@Inject(DB) private readonly db: Db) {
    this.svc = expressCompanyService(db);
  }

  list = () => this.svc.list();
  stats = () => this.svc.stats();
  getById = (companyId: string) => this.svc.getById(companyId);
}

