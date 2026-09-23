import { ApiProperty } from "@nestjs/swagger";
import { IsString, IsOptional, MaxLength, MinLength } from "class-validator";

export class CorrectFieldDto {
  @ApiProperty({ maxLength: 2000 }) @IsString() @MaxLength(2000) value!: string;
  @ApiProperty({ minLength: 1, maxLength: 2000 }) @IsString() @MinLength(1) @MaxLength(2000) justification!: string;
  @ApiProperty({ required: false, maxLength: 2000 }) @IsOptional() @IsString() @MaxLength(2000) excerpt?: string;
}
