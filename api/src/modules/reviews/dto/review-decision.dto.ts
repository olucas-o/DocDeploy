import { ApiProperty } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";

export const reviewDecisions = ["APPROVED", "REJECTED", "RETURNED_FOR_COMPLEMENT"] as const;

export class ReviewDecisionDto {
  @ApiProperty({ enum: reviewDecisions }) @IsIn(reviewDecisions) decision!: typeof reviewDecisions[number];
  @ApiProperty({ required: false, maxLength: 2000 }) @IsOptional() @IsString() @MaxLength(2000) justification?: string;
}
