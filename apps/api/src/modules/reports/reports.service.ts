import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { Decimal } from "@prisma/client/runtime/library";

import type { AuthenticatedUser } from "../../common/types/authenticated-request";
import { PrismaService } from "../../database/prisma.service";
import { ReportFinancialQueryDto } from "./dto/report-financial-query.dto";
import { buildCsv, buildPdf, buildXlsx, contentTypeFor, type ReportTable } from "./report-export.util";

const UNASSIGNED_KEY = "UNASSIGNED";
const UNASSIGNED_LABEL = "Non affecté";

interface Bucket {
  key: string;
  label: string;
  totalRevenue: Decimal;
  totalExpense: Decimal;
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async financialReport(query: ReportFinancialQueryDto, requester: AuthenticatedUser) {
    const now = new Date();
    const dateFrom = query.dateFrom
      ? new Date(query.dateFrom)
      : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const dateTo = query.dateTo
      ? new Date(query.dateTo)
      : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    if (dateFrom >= dateTo) {
      throw new BadRequestException("dateFrom doit être antérieure à dateTo");
    }

    const hotelWhere = requester.hotelId
      ? { hotelId: requester.hotelId }
      : { hotel: { organizationId: requester.organizationId } };

    await this.validateReferences(requester, query);

    const groupBy = query.groupBy ?? "month";
    const dimensionFilter = {
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
      ...(query.activityId ? { activityId: query.activityId } : {}),
      ...(query.costCenterId ? { costCenterId: query.costCenterId } : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
    };

    const [revenues, expenses, payments] = await Promise.all([
      this.prisma.revenue.findMany({
        where: { ...hotelWhere, ...dimensionFilter, date: { gte: dateFrom, lt: dateTo } },
        select: { amount: true, date: true, categoryId: true, departmentId: true, activityId: true },
      }),
      this.prisma.expense.findMany({
        where: {
          ...hotelWhere,
          ...dimensionFilter,
          status: { in: ["PAID", "BOOKED"] },
          date: { gte: dateFrom, lt: dateTo },
        },
        select: { amount: true, date: true, categoryId: true, departmentId: true, activityId: true },
      }),
      // Les paiements de factures sont une 2e source de recette, distincte de Revenue (même
      // principe que FinanceSummaryService, Phase 6) — les dimensions se lisent sur l'Invoice liée.
      this.prisma.payment.findMany({
        where: {
          date: { gte: dateFrom, lt: dateTo },
          invoice: { ...hotelWhere, ...dimensionFilter },
        },
        select: {
          amount: true,
          date: true,
          invoice: { select: { categoryId: true, departmentId: true, activityId: true } },
        },
      }),
    ]);

    const buckets = new Map<string, Bucket>();
    const getBucket = (key: string): Bucket => {
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = { key, label: key, totalRevenue: new Prisma.Decimal(0), totalExpense: new Prisma.Decimal(0) };
        buckets.set(key, bucket);
      }
      return bucket;
    };

    const keyFor = (date: Date, categoryId: string | null, departmentId: string | null, activityId: string | null): string => {
      switch (groupBy) {
        case "month":
          return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
        case "category":
          return categoryId ?? UNASSIGNED_KEY;
        case "department":
          return departmentId ?? UNASSIGNED_KEY;
        case "activity":
          return activityId ?? UNASSIGNED_KEY;
      }
    };

    for (const revenue of revenues) {
      const key = keyFor(revenue.date, revenue.categoryId, revenue.departmentId, revenue.activityId);
      getBucket(key).totalRevenue = getBucket(key).totalRevenue.plus(revenue.amount);
    }
    for (const payment of payments) {
      const key = keyFor(payment.date, payment.invoice.categoryId, payment.invoice.departmentId, payment.invoice.activityId);
      getBucket(key).totalRevenue = getBucket(key).totalRevenue.plus(payment.amount);
    }
    for (const expense of expenses) {
      const key = keyFor(expense.date, expense.categoryId, expense.departmentId, expense.activityId);
      getBucket(key).totalExpense = getBucket(key).totalExpense.plus(expense.amount);
    }

    await this.resolveLabels(groupBy, buckets);

    const rows = [...buckets.values()]
      .sort((a, b) => a.key.localeCompare(b.key))
      .map((bucket) => ({
        key: bucket.key,
        label: bucket.label,
        totalRevenue: bucket.totalRevenue,
        totalExpense: bucket.totalExpense,
        net: bucket.totalRevenue.minus(bucket.totalExpense),
      }));

    const totals = rows.reduce(
      (acc, row) => ({
        totalRevenue: acc.totalRevenue.plus(row.totalRevenue),
        totalExpense: acc.totalExpense.plus(row.totalExpense),
        net: acc.net.plus(row.net),
      }),
      { totalRevenue: new Prisma.Decimal(0), totalExpense: new Prisma.Decimal(0), net: new Prisma.Decimal(0) }
    );

    return {
      period: { dateFrom, dateTo },
      groupBy,
      filters: dimensionFilter,
      rows,
      totals,
    };
  }

  async financialReportExport(
    query: ReportFinancialQueryDto,
    format: "csv" | "xlsx" | "pdf",
    requester: AuthenticatedUser
  ): Promise<{ buffer: Buffer; contentType: string; filename: string }> {
    const report = await this.financialReport(query, requester);

    const table: ReportTable = {
      title: "Rapport financier",
      subtitle: `Période ${report.period.dateFrom.toISOString().slice(0, 10)} → ${report.period.dateTo.toISOString().slice(0, 10)} — groupé par ${report.groupBy}`,
      columns: [
        { key: "label", label: "Groupe" },
        { key: "totalRevenue", label: "Recettes" },
        { key: "totalExpense", label: "Dépenses" },
        { key: "net", label: "Net" },
      ],
      rows: [
        ...report.rows.map((row) => ({
          label: row.label,
          totalRevenue: row.totalRevenue.toFixed(2),
          totalExpense: row.totalExpense.toFixed(2),
          net: row.net.toFixed(2),
        })),
        {
          label: "TOTAL",
          totalRevenue: report.totals.totalRevenue.toFixed(2),
          totalExpense: report.totals.totalExpense.toFixed(2),
          net: report.totals.net.toFixed(2),
        },
      ],
    };

    const buffer = format === "csv" ? buildCsv(table) : format === "xlsx" ? await buildXlsx(table) : await buildPdf(table);
    const datePart = `${report.period.dateFrom.toISOString().slice(0, 10)}_${report.period.dateTo.toISOString().slice(0, 10)}`;
    return {
      buffer,
      contentType: contentTypeFor(format),
      filename: `rapport-financier-${datePart}.${format}`,
    };
  }

  private async resolveLabels(
    groupBy: ReportFinancialQueryDto["groupBy"],
    buckets: Map<string, Bucket>
  ): Promise<void> {
    if (groupBy === "month" || !groupBy) {
      return;
    }
    const ids = [...buckets.keys()].filter((key) => key !== UNASSIGNED_KEY);
    if (buckets.has(UNASSIGNED_KEY)) {
      buckets.get(UNASSIGNED_KEY)!.label = UNASSIGNED_LABEL;
    }
    if (ids.length === 0) {
      return;
    }

    if (groupBy === "category") {
      const categories = await this.prisma.financialCategory.findMany({ where: { id: { in: ids } } });
      for (const category of categories) {
        const bucket = buckets.get(category.id);
        if (bucket) {
          bucket.label = category.name;
        }
      }
    } else if (groupBy === "department") {
      const departments = await this.prisma.department.findMany({ where: { id: { in: ids } } });
      for (const department of departments) {
        const bucket = buckets.get(department.id);
        if (bucket) {
          bucket.label = department.name;
        }
      }
    } else if (groupBy === "activity") {
      const activities = await this.prisma.departmentActivity.findMany({ where: { id: { in: ids } } });
      for (const activity of activities) {
        const bucket = buckets.get(activity.id);
        if (bucket) {
          bucket.label = activity.name;
        }
      }
    }
  }

  // Un demandeur org-wide (pas de hotelId) n'a pas un hôtel unique contre lequel valider — un
  // identifiant invalide/hors périmètre ne casse rien : le where combiné plus bas ne remonte
  // simplement aucune ligne (résultat vide, pas une corruption), donc pas d'erreur à lever ici.
  private async validateReferences(requester: AuthenticatedUser, query: ReportFinancialQueryDto): Promise<void> {
    const hotelId = requester.hotelId;
    if (!hotelId) {
      return;
    }
    if (query.departmentId) {
      const department = await this.prisma.department.findUnique({ where: { id: query.departmentId } });
      if (!department || department.hotelId !== hotelId) {
        throw new BadRequestException("Département invalide");
      }
    }
    if (query.activityId) {
      const activity = await this.prisma.departmentActivity.findUnique({
        where: { id: query.activityId },
        include: { department: true },
      });
      if (!activity || activity.department.hotelId !== hotelId) {
        throw new BadRequestException("Activité invalide");
      }
    }
    if (query.costCenterId) {
      const costCenter = await this.prisma.costCenter.findUnique({ where: { id: query.costCenterId } });
      if (!costCenter || costCenter.hotelId !== hotelId) {
        throw new BadRequestException("Centre de coût invalide");
      }
    }
    if (query.categoryId) {
      const category = await this.prisma.financialCategory.findUnique({ where: { id: query.categoryId } });
      if (!category || category.hotelId !== hotelId) {
        throw new BadRequestException("Catégorie invalide");
      }
    }
  }
}
