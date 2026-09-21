import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";

export interface AuthenticatedPrincipal {
  userId: string;
  organizationId: string;
  permissions: string[];
}

export function jwtSecret(): string {
  const configured = process.env.JWT_SECRET;
  if (configured && configured.length >= 32) return configured;
  if (process.env.NODE_ENV === "test") return "test-only-secret-with-32-characters";
  throw new Error("JWT_SECRET must contain at least 32 characters");
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      algorithms: ["HS256"],
      audience: "docdeploy-web",
      issuer: "docdeploy-api",
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: jwtSecret(),
    });
  }

  validate(payload: { sub: string; organizationId: string; permissions?: string[] }): AuthenticatedPrincipal {
    return { userId: payload.sub, organizationId: payload.organizationId, permissions: payload.permissions ?? [] };
  }
}
