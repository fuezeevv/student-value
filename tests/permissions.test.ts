import { describe, it, expect } from "vitest";
import { hasPermission, requirePermission, UnauthorizedError, ForbiddenError } from "../src/lib/permissions/checker";
import { SessionUser } from "../src/lib/auth/session";

describe("Permissions Checker", () => {
  const studentUser: SessionUser = {
    id: "user-student-1",
    nickname: "ivan_student",
    avatarUrl: null,
    bio: null,
    isSystemAdmin: false,
    isOwner: false,
    groupId: "group-40102",
    permissions: [],
  };

  const courseManagerUser: SessionUser = {
    id: "user-manager-1",
    nickname: "course_moderator",
    avatarUrl: null,
    bio: null,
    isSystemAdmin: false,
    isOwner: false,
    groupId: "group-40102",
    permissions: ["manage_tasks", "manage_materials"],
  };

  const ownerUser: SessionUser = {
    id: "user-dev-owner",
    nickname: "rasul",
    avatarUrl: null,
    bio: null,
    isSystemAdmin: false,
    isOwner: true,
    groupId: "group-40102",
    permissions: ["manage_group", "manage_tasks", "verify_progress"],
  };

  it("denies permissions for regular student", () => {
    expect(hasPermission(studentUser, "manage_tasks")).toBe(false);
    expect(hasPermission(studentUser, "verify_progress")).toBe(false);
  });

  it("grants specific assigned permissions to course manager", () => {
    expect(hasPermission(courseManagerUser, "manage_tasks")).toBe(true);
    expect(hasPermission(courseManagerUser, "manage_materials")).toBe(true);
    expect(hasPermission(courseManagerUser, "verify_progress")).toBe(false);
  });

  it("grants all permissions to group owner", () => {
    expect(hasPermission(ownerUser, "manage_tasks")).toBe(true);
    expect(hasPermission(ownerUser, "verify_progress")).toBe(true);
    expect(hasPermission(ownerUser, "manage_group")).toBe(true);
    expect(hasPermission(ownerUser, "any_custom_permission")).toBe(true);
  });

  it("throws UnauthorizedError when session is missing", async () => {
    await expect(requirePermission(null, "manage_tasks")).rejects.toThrow(UnauthorizedError);
  });

  it("throws ForbiddenError when user lacks the required permission", async () => {
    await expect(requirePermission(studentUser, "manage_tasks")).rejects.toThrow(ForbiddenError);
  });

  it("resolves without error when user has required permission", async () => {
    await expect(requirePermission(ownerUser, "manage_tasks")).resolves.toBeUndefined();
  });
});
