import { ApiProperty } from "@nestjs/swagger";
import { IsIn, IsString, MaxLength, MinLength } from "class-validator";

export const reviewTaskResolutions = ["RESOLVED", "CANCELLED"] as const;

export class ResolveReviewTaskDto {
  @ApiProperty({ enum: reviewTaskResolutions }) @IsIn(reviewTaskResolutions) state!: typeof reviewTaskResolutions[number];
  @ApiProperty({ minLength: 1, maxLength: 2000 }) @IsString() @MinLength(1) @MaxLength(2000) resolution!: string;
}
