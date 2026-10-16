import { describe, it, expect } from "vitest";
import {
  createNotification,
  markNotificationRead,
} from "../src/server/services/notification-service";
import { prisma } from "../src/lib/db/prisma";

describe("Notification Service", () => {
  const testUserId = "user-dev-student";

  it("creates in-app notification and allows marking it read", async () => {
    const notif = await createNotification({
      userId: testUserId,
      title: "Тестовое оповещение",
      message: "Проверка работы сервиса уведомлений",
      type: "TASK_NEW",
      link: "/tasks/task-otu-lab1",
    });

    expect(notif.id).toBeDefined();
    expect(notif.isRead).toBe(false);

    // Mark as read
    await markNotificationRead(notif.id, testUserId);

    const updated = await prisma.notification.findUnique({
      where: { id: notif.id },
    });

    expect(updated?.isRead).toBe(true);

    // Clean up
    await prisma.notification.delete({ where: { id: notif.id } });
  });
});
