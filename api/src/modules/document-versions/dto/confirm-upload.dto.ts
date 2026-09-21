import { ApiProperty } from "@nestjs/swagger";
import { IsIn, IsInt, IsOptional, IsString, Matches, Max, Min } from "class-validator";

import { MAX_UPLOAD_BYTES, uploadContentTypes } from "../../documents/dto/create-document.dto.js";

export class ConfirmUploadDto {
  @ApiProperty({ pattern: "^[a-f0-9]{64}$" }) @Matches(/^[a-f0-9]{64}$/i) sha256!: string;
  @ApiProperty({ enum: uploadContentTypes }) @IsIn(uploadContentTypes) contentType!: typeof uploadContentTypes[number];
  @ApiProperty({ maximum: MAX_UPLOAD_BYTES, minimum: 1 }) @IsInt() @Min(1) @Max(MAX_UPLOAD_BYTES) size!: number;
  @ApiProperty({ required: false }) @IsOptional() @IsString() objectVersionId?: string;
}
