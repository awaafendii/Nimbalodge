import { Controller, Get, Query, Res } from "@nestjs/common";
import type { Response } from "express";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import type { AuthenticatedUser } from "../../common/types/authenticated-request";
import { ReportFinancialQueryDto } from "./dto/report-financial-query.dto";
import { ReportsService } from "./reports.service";

@Controller("reports")
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  // format=json (défaut) : Nest sérialise le `return` normalement. format=csv/xlsx/pdf : la
  // réponse binaire est envoyée directement via `res.send()` — passthrough:true laisse Nest gérer
  // le cas JSON standard sans conflit, Nest ne ré-envoie rien une fois `res.send()` déjà appelé.
  @Get("financial")
  @RequirePermissions("reports.financial.view")
  async financial(
    @Query() query: ReportFinancialQueryDto,
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response
  ) {
    const format = query.format ?? "json";
    if (format === "json") {
      return this.reportsService.financialReport(query, user);
    }

    const { buffer, contentType, filename } = await this.reportsService.financialReportExport(query, format, user);
    res.set({
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
    });
    res.send(buffer);
  }
}
