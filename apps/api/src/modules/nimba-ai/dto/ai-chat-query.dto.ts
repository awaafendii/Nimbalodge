import { Type } from "class-transformer";
import { IsArray, IsIn, IsOptional, IsString, MaxLength, ValidateNested } from "class-validator";

import type { LLMMessageRole } from "../providers/llm-provider.interface";

const MESSAGE_ROLES: LLMMessageRole[] = ["user", "assistant", "system", "tool"];

// v1 sans état (voir StatelessConversationProvider) : le frontend renvoie l'historique complet à
// chaque tour, validé ici avant d'atteindre AiChatService — jamais de contenu non borné transmis
// tel quel au LLM.
class AiChatHistoryMessageDto {
  @IsIn(MESSAGE_ROLES)
  role!: LLMMessageRole;

  @IsString()
  @MaxLength(8000)
  content!: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  toolCallId?: string;
}

export class AiChatQueryDto {
  @IsString()
  @MaxLength(2000)
  message!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  conversationId?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AiChatHistoryMessageDto)
  history?: AiChatHistoryMessageDto[];
}
