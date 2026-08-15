import { Module } from "@nestjs/common";

import { CreditNotesService } from "./credit-notes.service";
import { InvoicesController } from "./invoices.controller";
import { InvoicesService } from "./invoices.service";
import { PaymentsService } from "./payments.service";

@Module({
  controllers: [InvoicesController],
  providers: [InvoicesService, PaymentsService, CreditNotesService],
  exports: [InvoicesService],
})
export class InvoicesModule {}
