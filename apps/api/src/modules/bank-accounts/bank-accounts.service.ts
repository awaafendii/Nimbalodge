import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, type BankAccount } from "@prisma/client";
import type { Decimal } from "@prisma/client/runtime/library";

import type { AuthenticatedUser } from "../../common/types/authenticated-request";
import { assertInScope } from "../../common/utils/assert-in-scope";
import { PrismaService } from "../../database/prisma.service";
import { toBankAccountResponse } from "./dto/bank-account-response.dto";
import { CreateBankAccountDto } from "./dto/create-bank-account.dto";
import { CreateBankTransactionDto } from "./dto/create-bank-transaction.dto";
import { UpdateBankAccountDto } from "./dto/update-bank-account.dto";

@Injectable()
export class BankAccountsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(requester: AuthenticatedUser) {
    const accounts = await this.prisma.bankAccount.findMany({
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

  async create(dto: CreateBankAccountDto, requester: AuthenticatedUser) {
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

    const existing = await this.prisma.bankAccount.findUnique({
      where: { hotelId_name: { hotelId, name: dto.name } },
    });
    if (existing) {
      throw new ConflictException("Un compte bancaire avec ce nom existe déjà pour cet hôtel");
    }

    const account = await this.prisma.bankAccount.create({
      data: {
        hotelId,
        name: dto.name,
        bankName: dto.bankName,
        accountNumber: dto.accountNumber,
        openingBalance: dto.openingBalance ?? 0,
        currency: dto.currency,
        managerId: dto.managerId,
      },
    });
    return this.withBalance(account);
  }

  async update(id: string, dto: UpdateBankAccountDto, requester: AuthenticatedUser) {
    const account = await this.findWithHotelOrThrow(id);
    assertInScope(account.hotel.organizationId, account.hotelId, requester);

    if (dto.name && dto.name !== account.name) {
      const existing = await this.prisma.bankAccount.findUnique({
        where: { hotelId_name: { hotelId: account.hotelId, name: dto.name } },
      });
      if (existing) {
        throw new ConflictException("Un compte bancaire avec ce nom existe déjà pour cet hôtel");
      }
    }

    const updated = await this.prisma.bankAccount.update({ where: { id }, data: dto });
    return this.withBalance(updated);
  }

  async listTransactions(id: string, requester: AuthenticatedUser) {
    const account = await this.findWithHotelOrThrow(id);
    assertInScope(account.hotel.organizationId, account.hotelId, requester);
    return this.prisma.bankTransaction.findMany({ where: { bankAccountId: id }, orderBy: { date: "asc" } });
  }

  async addTransaction(id: string, dto: CreateBankTransactionDto, requester: AuthenticatedUser) {
    const account = await this.findWithHotelOrThrow(id);
    assertInScope(account.hotel.organizationId, account.hotelId, requester);

    return this.prisma.bankTransaction.create({
      data: {
        bankAccountId: id,
        direction: dto.direction,
        amount: dto.amount,
        label: dto.label,
        date: dto.date ? new Date(dto.date) : undefined,
        createdById: requester.id,
      },
    });
  }

  async computeBalance(bankAccountId: string, openingBalance: Decimal): Promise<Decimal> {
    const [inSum, outSum] = await Promise.all([
      this.prisma.bankTransaction.aggregate({
        where: { bankAccountId, direction: "IN" },
        _sum: { amount: true },
      }),
      this.prisma.bankTransaction.aggregate({
        where: { bankAccountId, direction: "OUT" },
        _sum: { amount: true },
      }),
    ]);
    const inTotal = inSum._sum.amount ?? new Prisma.Decimal(0);
    const outTotal = outSum._sum.amount ?? new Prisma.Decimal(0);
    return openingBalance.plus(inTotal).minus(outTotal);
  }

  private async withBalance(account: BankAccount) {
    const balance = await this.computeBalance(account.id, account.openingBalance);
    return toBankAccountResponse(account, balance);
  }

  private async findWithHotelOrThrow(id: string) {
    const account = await this.prisma.bankAccount.findUnique({ where: { id }, include: { hotel: true } });
    if (!account) {
      throw new NotFoundException("Compte bancaire introuvable");
    }
    return account;
  }
}
