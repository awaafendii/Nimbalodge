import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import type { AuthenticatedUser } from "../../common/types/authenticated-request";
import { CreditNotesService } from "./credit-notes.service";
import { CreateCreditNoteDto } from "./dto/create-credit-note.dto";
import { CreateInvoiceDto } from "./dto/create-invoice.dto";
import { CreatePaymentDto } from "./dto/create-payment.dto";
import { UpdateInvoiceDto } from "./dto/update-invoice.dto";
import { InvoicesService } from "./invoices.service";
import { PaymentsService } from "./payments.service";

@Controller("invoices")
export class InvoicesController {
  constructor(
    private readonly invoicesService: InvoicesService,
    private readonly paymentsService: PaymentsService,
    private readonly creditNotesService: CreditNotesService
  ) {}

  @Get()
  @RequirePermissions("finance-invoices.view")
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.invoicesService.list(user);
  }

  // Route statique déclarée AVANT /:id — sinon Nest matcherait "receivables" comme un id.
  @Get("receivables")
  @RequirePermissions("finance-invoices.view")
  receivables(@CurrentUser() user: AuthenticatedUser) {
    return this.invoicesService.receivables(user);
  }

  @Get(":id")
  @RequirePermissions("finance-invoices.view")
  findOne(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.invoicesService.findOne(id, user);
  }

  @Post()
  @RequirePermissions("finance-invoices.create")
  create(@Body() dto: CreateInvoiceDto, @CurrentUser() user: AuthenticatedUser) {
    return this.invoicesService.create(dto, user);
  }

  @Patch(":id")
  @RequirePermissions("finance-invoices.update")
  update(@Param("id") id: string, @Body() dto: UpdateInvoiceDto, @CurrentUser() user: AuthenticatedUser) {
    return this.invoicesService.update(id, dto, user);
  }

  @Post(":id/issue")
  @RequirePermissions("finance-invoices.issue")
  issue(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.invoicesService.issue(id, user);
  }

  @Post(":id/cancel")
  @RequirePermissions("finance-invoices.cancel")
  cancel(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.invoicesService.cancel(id, user);
  }

  @Get(":id/payments")
  @RequirePermissions("finance-payments.view")
  listPayments(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.paymentsService.list(id, user);
  }

  @Post(":id/payments")
  @RequirePermissions("finance-payments.create")
  createPayment(@Param("id") id: string, @Body() dto: CreatePaymentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.paymentsService.create(id, dto, user);
  }

  @Get(":id/credit-notes")
  @RequirePermissions("finance-credit-notes.view")
  listCreditNotes(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.creditNotesService.list(id, user);
  }

  @Post(":id/credit-notes")
  @RequirePermissions("finance-credit-notes.create")
  createCreditNote(
    @Param("id") id: string,
    @Body() dto: CreateCreditNoteDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.creditNotesService.create(id, dto, user);
  }
}
