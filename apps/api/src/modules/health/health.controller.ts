import { Controller, Get, HttpCode, HttpStatus, ServiceUnavailableException } from "@nestjs/common";

import { Public } from "../../common/decorators/public.decorator";
import { HealthService } from "./health.service";

@Controller("health")
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  // @Public() : le healthcheck Docker/monitoring (contrat Phase 2) doit rester accessible sans
  // JWT une fois les guards globaux d'auth posés par AuthModule.
  @Public()
  @Get()
  @HttpCode(HttpStatus.OK)
  async check() {
    const result = await this.healthService.check();
    if (result.status === "error") {
      throw new ServiceUnavailableException(result);
    }
    return result;
  }
}
