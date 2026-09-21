import { ApiProperty } from "@nestjs/swagger";
import { IsDateString, IsIn, IsInt, IsString, IsUUID, Matches, Max, MaxLength, Min } from "class-validator";

export const documentTypes = ["contract", "invoice", "certificate", "report", "registration"] as const;
export const uploadContentTypes = ["application/pdf", "image/png", "image/jpeg"] as const;
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export class CreateDocumentDto {
  @ApiProperty({ maxLength: 255 }) @IsString() @MaxLength(255) name!: string;
  @ApiProperty({ enum: documentTypes }) @IsIn(documentTypes) type!: typeof documentTypes[number];
  @ApiProperty({ maxLength: 255 }) @IsString() @MaxLength(255) origin!: string;
  @ApiProperty({ format: "date-time" }) @IsDateString() receivedAt!: string;
  @ApiProperty({ format: "uuid" }) @IsUUID() responsibleId!: string;
  @ApiProperty({ maxLength: 255 }) @IsString() @MaxLength(255) fileName!: string;
  @ApiProperty({ enum: uploadContentTypes }) @IsIn(uploadContentTypes) contentType!: typeof uploadContentTypes[number];
  @ApiProperty({ maximum: MAX_UPLOAD_BYTES, minimum: 1 }) @IsInt() @Min(1) @Max(MAX_UPLOAD_BYTES) size!: number;
  @ApiProperty({ pattern: "^[a-f0-9]{64}$" }) @Matches(/^[a-f0-9]{64}$/i) sha256!: string;
}
