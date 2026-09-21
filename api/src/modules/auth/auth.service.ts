import { randomBytes, randomUUID } from "node:crypto";

import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as argon2 from "argon2";
import { DataSource } from "typeorm";

import { Session } from "../../database/entities/session.entity.js";

const ARGON_OPTIONS: argon2.Options & { type: typeof argon2.argon2id } = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
};

export async function hashRefreshToken(token: string): Promise<string> {
  return argon2.hash(token, ARGON_OPTIONS);
}

export async function verifyRefreshToken(hash: string, token: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, token);
  } catch {
    return false;
  }
}

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
  refreshTokenHash: string;
  family: string;
  sessionId?: string;
}

@Injectable()
export class AuthService {
  constructor(private readonly jwt: JwtService, private readonly dataSource: DataSource) {}

  async hashPassword(password: string): Promise<string> {
    return argon2.hash(password, ARGON_OPTIONS);
  }

  async verifyPassword(hash: string, password: string): Promise<void> {
    if (!(await argon2.verify(hash, password))) throw new UnauthorizedException("Invalid credentials");
  }

  async issueTokens(userId: string, organizationId: string, permissions: string[], family: string = randomUUID()): Promise<SessionTokens> {
    const refreshToken = randomBytes(48).toString("base64url");
    const accessToken = await this.jwt.signAsync(
      { sub: userId, organizationId, permissions },
      { algorithm: "HS256", audience: "docdeploy-web", expiresIn: "10m", issuer: "docdeploy-api" },
    );
    return { accessToken, refreshToken, refreshTokenHash: await hashRefreshToken(refreshToken), family };
  }

  async authenticate(email: string, password: string, deviceMetadata: Record<string, unknown>, requestedOrganizationId?: string): Promise<SessionTokens> {
    type LoginRow = { user_id: string; password_hash: string; organization_id: string; permissions: string[] };
    const rows = await this.dataSource.query<LoginRow[]>("SELECT * FROM public.resolve_login($1)", [email]);
    if (!rows[0]?.password_hash) throw new UnauthorizedException("Invalid credentials");
    await this.verifyPassword(rows[0].password_hash, password);
    const membership = requestedOrganizationId
      ? rows.find((row) => row.organization_id === requestedOrganizationId)
      : rows.length === 1 ? rows[0] : undefined;
    if (!membership) throw new UnauthorizedException("Organization selection is required or invalid");
    const tokens = await this.issueTokens(membership.user_id, membership.organization_id, membership.permissions);
    const sessionId = await this.withTenant(membership.organization_id, async (manager) => {
      const saved = await manager.save(Session, manager.create(Session, {
        organizationId: membership.organization_id,
        userId: membership.user_id,
        refreshTokenHash: tokens.refreshTokenHash,
        tokenFamily: tokens.family,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        revokedAt: null,
        deviceMetadata,
      }));
      return saved.id;
    });
    return { ...tokens, sessionId };
  }

  async rotateRefreshToken(cookieValue: string): Promise<SessionTokens> {
    const [sessionId, presentedToken] = cookieValue.split(".", 2);
    if (!sessionId || !presentedToken) throw new UnauthorizedException("Invalid session");
    type SessionRow = { session_id: string; user_id: string; organization_id: string; refresh_token_hash: string; token_family: string; expires_at: Date; permissions: string[] };
    const [session] = await this.dataSource.query<SessionRow[]>("SELECT * FROM public.resolve_session($1::uuid)", [sessionId]);
    if (!session || session.expires_at <= new Date() || !(await verifyRefreshToken(session.refresh_token_hash, presentedToken))) {
      if (session) await this.revokeFamily(session.organization_id, session.token_family);
      throw new UnauthorizedException("Invalid session");
    }
    const tokens = await this.issueTokens(session.user_id, session.organization_id, session.permissions, session.token_family);
    await this.withTenant(session.organization_id, async (manager) => {
      await manager.update(Session, { id: session.session_id }, { refreshTokenHash: tokens.refreshTokenHash, expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) });
    });
    return { ...tokens, sessionId: session.session_id };
  }

  async revoke(cookieValue: string | undefined): Promise<void> {
    const sessionId = cookieValue?.split(".", 1)[0];
    if (!sessionId) return;
    type SessionContext = { organization_id: string };
    const [session] = await this.dataSource.query<SessionContext[]>("SELECT organization_id FROM public.resolve_session($1::uuid)", [sessionId]);
    if (session) await this.withTenant(session.organization_id, async (manager) => {
      await manager.update(Session, { id: sessionId }, { revokedAt: new Date() });
    });
  }

  private async revokeFamily(organizationId: string, tokenFamily: string): Promise<void> {
    await this.withTenant(organizationId, async (manager) => {
      await manager.update(Session, { tokenFamily }, { revokedAt: new Date() });
    });
  }

  private async withTenant<T>(organizationId: string, operation: (manager: import("typeorm").EntityManager) => Promise<T>): Promise<T> {
    return this.dataSource.transaction(async (manager) => {
      await manager.query("SELECT set_config('app.organization_id', $1, true)", [organizationId]);
      return operation(manager);
    });
  }
}
