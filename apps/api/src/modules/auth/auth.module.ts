import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";

import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { PermissionsModule } from "../permissions/permissions.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtAccessStrategy } from "./jwt-access.strategy";
import { PasswordResetController } from "./password-reset.controller";
import { PasswordResetService } from "./password-reset.service";
import { TwoFactorController } from "./two-factor.controller";
import { TwoFactorService } from "./two-factor.service";

// JwtModule.register({}) sans secret par défaut : AuthService signe/vérifie access et refresh
// avec deux secrets distincts (JWT_ACCESS_SECRET / JWT_REFRESH_SECRET) passés explicitement à
// chaque appel — plus simple que deux instances de JwtService nommées séparément.
@Module({
  imports: [PassportModule, JwtModule.register({}), PermissionsModule],
  controllers: [AuthController, PasswordResetController, TwoFactorController],
  providers: [
    AuthService,
    PasswordResetService,
    TwoFactorService,
    JwtAccessStrategy,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AuthModule {}
