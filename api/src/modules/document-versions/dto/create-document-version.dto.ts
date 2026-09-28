import { IsBoolean, IsISO8601, IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";
import { IsInt, Max, Min } from "class-validator";

import { MAX_UPLOAD_BYTES, uploadContentTypes } from "../../documents/dto/create-document.dto.js";

export class CreateDocumentVersionDto {
  @IsString() @MinLength(1) @MaxLength(255) fileName!: string;
  @IsString() @Matches(new RegExp(`^(${uploadContentTypes.join("|").replaceAll("/", "\\/")})$`)) contentType!: string;
  @IsInt() @Min(1) @Max(MAX_UPLOAD_BYTES) size!: number;
  @IsString() @Matches(/^[a-f0-9]{64}$/i) sha256!: string;
  @IsString() @MinLength(1) @MaxLength(1000) replacementReason!: string;
  @IsBoolean() confirmDuplicate!: boolean;
  @IsOptional() @IsISO8601() receivedAt?: string;
}
