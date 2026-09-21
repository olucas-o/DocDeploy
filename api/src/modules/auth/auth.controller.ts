import { Body, Controller, HttpCode, Post, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";

import { AuthService } from "./auth.service.js";

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("session")
  async createSession(@Body() body: { email: string; password: string; organizationId?: string }, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const tokens = await this.auth.authenticate(body.email, body.password, { userAgent: request.header("user-agent")?.slice(0, 255) }, body.organizationId);
    this.setRefreshCookie(response, `${tokens.sessionId}.${tokens.refreshToken}`);
    return { accessToken: tokens.accessToken };
  }

  @Post("refresh")
  async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const tokens = await this.auth.rotateRefreshToken(String(request.cookies?.refresh_token ?? ""));
    this.setRefreshCookie(response, `${tokens.sessionId}.${tokens.refreshToken}`);
    return { accessToken: tokens.accessToken };
  }

  @Post("logout")
  @HttpCode(204)
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response): Promise<void> {
    await this.auth.revoke(request.cookies?.refresh_token as string | undefined);
    response.clearCookie("refresh_token", { httpOnly: true, secure: true, sameSite: "strict", path: "/api/v1/auth" });
  }

  private setRefreshCookie(response: Response, value: string): void {
    response.cookie("refresh_token", value, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/api/v1/auth", maxAge: 30 * 24 * 60 * 60 * 1000 });
  }
}
