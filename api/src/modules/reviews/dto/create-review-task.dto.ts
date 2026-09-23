import { ApiProperty } from "@nestjs/swagger";
import { IsDateString, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

export class CreateReviewTaskDto {
  @ApiProperty({ maxLength: 255 }) @IsString() @MaxLength(255) title!: string;
  @ApiProperty({ format: "uuid" }) @IsUUID() responsibleId!: string;
  @ApiProperty({ required: false, format: "date-time" }) @IsOptional() @IsDateString() dueAt?: string;
}
