import { ApiProperty } from "@nestjs/swagger";
import { IsString, MaxLength, MinLength } from "class-validator";

export class CreateReviewCommentDto {
  @ApiProperty({ minLength: 1, maxLength: 4000 }) @IsString() @MinLength(1) @MaxLength(4000) message!: string;
}
