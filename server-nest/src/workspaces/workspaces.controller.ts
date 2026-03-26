import { Controller } from "@nestjs/common";
import { CompaniesController } from "../companies/companies.controller.js";

@Controller("workspaces")
export class WorkspacesController extends CompaniesController {}
