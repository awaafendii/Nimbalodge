import { Prisma, type CreditNote, type Invoice, type InvoiceLine, type Payment } from "@prisma/client";
import type { Decimal } from "@prisma/client/runtime/library";

export interface InvoiceTotals {
  subtotal: Decimal;
  discountTotal: Decimal;
  taxTotal: Decimal;
  grandTotal: Decimal;
  amountPaid: Decimal;
  amountCredited: Decimal;
  dueBalance: Decimal;
}

type LineFields = Pick<InvoiceLine, "quantity" | "unitPrice" | "discountRate" | "taxRate">;

// quantity × unitPrice × (1 − discountRate) × (1 + taxRate).
export function computeLineTotal(line: LineFields): Decimal {
  const base = line.quantity.times(line.unitPrice);
  const afterDiscount = base.minus(base.times(line.discountRate));
  return afterDiscount.plus(afterDiscount.times(line.taxRate));
}

// Calculé à la demande, jamais stocké — même principe que le solde CashAccount (Phase 5).
export function computeInvoiceTotals(lines: InvoiceLine[], payments: Payment[], creditNotes: CreditNote[]): InvoiceTotals {
  let subtotal = new Prisma.Decimal(0);
  let discountTotal = new Prisma.Decimal(0);
  let taxTotal = new Prisma.Decimal(0);

  for (const line of lines) {
    const base = line.quantity.times(line.unitPrice);
    const discount = base.times(line.discountRate);
    const afterDiscount = base.minus(discount);
    const tax = afterDiscount.times(line.taxRate);
    subtotal = subtotal.plus(base);
    discountTotal = discountTotal.plus(discount);
    taxTotal = taxTotal.plus(tax);
  }

  const grandTotal = subtotal.minus(discountTotal).plus(taxTotal);
  const amountPaid = payments.reduce((sum, payment) => sum.plus(payment.amount), new Prisma.Decimal(0));
  const amountCredited = creditNotes.reduce((sum, note) => sum.plus(note.amount), new Prisma.Decimal(0));
  const dueBalance = grandTotal.minus(amountPaid).minus(amountCredited);

  return { subtotal, discountTotal, taxTotal, grandTotal, amountPaid, amountCredited, dueBalance };
}

type FullInvoice = Invoice & { lines: InvoiceLine[]; payments: Payment[]; creditNotes: CreditNote[] };

export function toInvoiceResponse(invoice: FullInvoice) {
  const totals = computeInvoiceTotals(invoice.lines, invoice.payments, invoice.creditNotes);
  return {
    id: invoice.id,
    hotelId: invoice.hotelId,
    departmentId: invoice.departmentId,
    activityId: invoice.activityId,
    costCenterId: invoice.costCenterId,
    categoryId: invoice.categoryId,
    status: invoice.status,
    invoiceNumber: invoice.invoiceNumber,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    currency: invoice.currency,
    clientName: invoice.clientName,
    clientType: invoice.clientType,
    clientContact: invoice.clientContact,
    clientAddress: invoice.clientAddress,
    guestId: invoice.guestId,
    reservationId: invoice.reservationId,
    createdById: invoice.createdById,
    lines: invoice.lines.map((line) => ({
      id: line.id,
      description: line.description,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      discountRate: line.discountRate,
      taxRate: line.taxRate,
      lineTotal: computeLineTotal(line),
    })),
    ...totals,
    createdAt: invoice.createdAt,
  };
}
