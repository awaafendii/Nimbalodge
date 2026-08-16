import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, type CashAccount } from "@prisma/client";
import type { Decimal } from "@prisma/client/runtime/library";

import type { AuthenticatedUser } from "../../common/types/authenticated-request";
import { assertInScope } from "../../common/utils/assert-in-scope";
import { PrismaService } from "../../database/prisma.service";
import { toCashAccountResponse } from "./dto/cash-account-response.dto";
import { CreateCashAccountDto } from "./dto/create-cash-account.dto";
import { CreateCashTransactionDto } from "./dto/create-cash-transaction.dto";
import { UpdateCashAccountDto } from "./dto/update-cash-account.dto";

@Injectable()
export class CashAccountsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(requester: AuthenticatedUser) {
    const accounts = await this.prisma.cashAccount.findMany({
      where: requester.hotelId
        ? { hotelId: requester.hotelId }
        : { hotel: { organizationId: requester.organizationId } },
      orderBy: { createdAt: "asc" },
    });
    return Promise.all(accounts.map((account) => this.withBalance(account)));
  }

  async findOne(id: string, requester: AuthenticatedUser) {
    const account = await this.findWithHotelOrThrow(id);
    assertInScope(account.hotel.organizationId, account.hotelId, requester);
    return this.withBalance(account);
  }

  async create(dto: CreateCashAccountDto, requester: AuthenticatedUser) {
    const hotelId = requester.hotelId ?? dto.hotelId;
    if (!hotelId) {
      throw new BadRequestException("hotelId requis");
    }
    if (requester.hotelId && dto.hotelId && dto.hotelId !== requester.hotelId) {
      throw new ForbiddenException("Hors périmètre de votre hôtel");
    }

    const hotel = await this.prisma.hotel.findUnique({ where: { id: hotelId } });
    if (!hotel || hotel.organizationId !== requester.organizationId) {
      throw new BadRequestException("Hôtel invalide");
    }

    const existing = await this.prisma.cashAccount.findUnique({
      where: { hotelId_name: { hotelId, name: dto.name } },
    });
    if (existing) {
      throw new ConflictException("Une caisse avec ce nom existe déjà pour cet hôtel");
    }

    const account = await this.prisma.cashAccount.create({
      data: {
        hotelId,
        name: dto.name,
        code: dto.code,
        openingBalance: dto.openingBalance ?? 0,
        currency: dto.currency,
        managerId: dto.managerId,
      },
    });
    return this.withBalance(account);
  }

  async update(id: string, dto: UpdateCashAccountDto, requester: AuthenticatedUser) {
    const account = await this.findWithHotelOrThrow(id);
    assertInScope(account.hotel.organizationId, account.hotelId, requester);

    if (dto.name && dto.name !== account.name) {
      const existing = await this.prisma.cashAccount.findUnique({
        where: { hotelId_name: { hotelId: account.hotelId, name: dto.name } },
      });
      if (existing) {
        throw new ConflictException("Une caisse avec ce nom existe déjà pour cet hôtel");
      }
    }

    const updated = await this.prisma.cashAccount.update({ where: { id }, data: dto });
    return this.withBalance(updated);
  }

  async listTransactions(id: string, requester: AuthenticatedUser) {
    const account = await this.findWithHotelOrThrow(id);
    assertInScope(account.hotel.organizationId, account.hotelId, requester);
    return this.prisma.cashTransaction.findMany({ where: { cashAccountId: id }, orderBy: { date: "asc" } });
  }

  async addTransaction(id: string, dto: CreateCashTransactionDto, requester: AuthenticatedUser) {
    const account = await this.findWithHotelOrThrow(id);
    assertInScope(account.hotel.organizationId, account.hotelId, requester);

    return this.prisma.cashTransaction.create({
      data: {
        cashAccountId: id,
        direction: dto.direction,
        amount: dto.amount,
        label: dto.label,
        date: dto.date ? new Date(dto.date) : undefined,
        createdById: requester.id,
      },
    });
  }

  async computeBalance(cashAccountId: string, openingBalance: Decimal): Promise<Decimal> {
    const [inSum, outSum] = await Promise.all([
      this.prisma.cashTransaction.aggregate({
        where: { cashAccountId, direction: "IN" },
        _sum: { amount: true },
      }),
      this.prisma.cashTransaction.aggregate({
        where: { cashAccountId, direction: "OUT" },
        _sum: { amount: true },
      }),
    ]);
    const inTotal = inSum._sum.amount ?? new Prisma.Decimal(0);
    const outTotal = outSum._sum.amount ?? new Prisma.Decimal(0);
    return openingBalance.plus(inTotal).minus(outTotal);
  }

  private async withBalance(account: CashAccount) {
    const balance = await this.computeBalance(account.id, account.openingBalance);
    return toCashAccountResponse(account, balance);
  }

  private async findWithHotelOrThrow(id: string) {
    const account = await this.prisma.cashAccount.findUnique({ where: { id }, include: { hotel: true } });
    if (!account) {
      throw new NotFoundException("Caisse introuvable");
    }
    return account;
  }
}
