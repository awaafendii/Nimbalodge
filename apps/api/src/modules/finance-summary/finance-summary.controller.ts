import { Controller, Get, Query } from "@nestjs/common";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import type { AuthenticatedUser } from "../../common/types/authenticated-request";
import { FinanceSummaryQueryDto } from "./dto/finance-summary-query.dto";
import { FinanceSummaryService } from "./finance-summary.service";

@Controller("finance/summary")
export class FinanceSummaryController {
  constructor(private readonly financeSummaryService: FinanceSummaryService) {}

  @Get()
  @RequirePermissions("finance.summary.view")
  getSummary(@Query() query: FinanceSummaryQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.financeSummaryService.getSummary(query, user);
  }
}
