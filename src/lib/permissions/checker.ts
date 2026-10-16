import { SessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export class UnauthorizedError extends Error {
  statusCode = 401;
  constructor(message = "Не авторизован") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  statusCode = 403;
  constructor(message = "Недостаточно прав для выполнения действия") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export function hasPermission(user: SessionUser | null, permission: string): boolean {
  if (!user) return false;
  if (user.isSystemAdmin || user.isOwner) return true;
  return user.permissions.includes(permission);
}

export async function requirePermission(
  user: SessionUser | null,
  permission: string,
  contextPath = "action"
): Promise<void> {
  if (!user) {
    throw new UnauthorizedError("Для совершения этого действия необходимо войти в систему.");
  }

  if (!hasPermission(user, permission)) {
    // Minimal Security Log (ADR-013 & user note 4: lightweight, does not delay flow)
    try {
      if (user.id && (user.id.startsWith("user-dev-") || user.id.length === 36)) {
        await prisma.securityAccessLog.create({
          data: {
            userId: user.id,
            event: "403_FORBIDDEN",
            path: contextPath,
            method: "ACTION",
            details: { requiredPermission: permission, userNickname: user.nickname },
          },
        });
      }
    } catch {
      // In case logging fails, do not block throwing the security exception
    }

    throw new ForbiddenError(
      `Отказ в доступе: требуется право '${permission}'. Ваши текущие права не позволяют выполнить это действие.`
    );
  }
}
