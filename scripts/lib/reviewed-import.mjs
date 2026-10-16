import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";

const order = [
  "user",
  "studyGroup",
  "semester",
  "courseDefinition",
  "teacher",
  "courseOffering",
  "courseOfferingGroup",
  "role",
  "rolePermission",
  "groupMember",
  "userGroupRole",
  "enrollment",
  "classSession",
  "transcript",
  "source",
  "sourceReference",
  "courseTeacher",
  "task",
  "taskAudience",
  "taskVariant",
  "variantAssignment",
  "deadline",
  "studentTaskProgress",
  "taskDependency",
  "courseMaterial",
  "taskMaterial",
  "announcement",
  "auditLog",
  "notification",
  "xpRule",
  "xpEvent",
  "userGamificationProfile",
  "achievementDefinition",
  "userAchievement",
  "aiSuggestion",
];
const models = Prisma.dmmf.datamodel.models;
const nameOf = (model) => model.name[0].toLowerCase() + model.name.slice(1);

export function parseReviewedImport(bytes, expectedDigest) {
  const digest = createHash("sha256").update(bytes).digest("hex");
  assert.equal(digest, expectedDigest, "Reviewed import digest changed");
  const plan = JSON.parse(bytes);
  assert.equal(plan.version, 1);
  assert.equal(plan.groupCode, "5130901/40102");
  assert.match(plan.sourceSha256, /^[a-f0-9]{64}$/);
  assert.equal(plan.rows.studyGroup.length, 1);
  assert.equal(plan.rows.studyGroup[0].code, plan.groupCode);
  assert(
    Object.keys(plan.rows).every((model) => order.includes(model)),
    "Auth identities, sessions and integrations are never imported",
  );
  assert(
    plan.rows.user.every((user) => !user.isSystemAdmin),
    "Global administrator flags are not imported",
  );
  assert(
    plan.rows.enrollment.every((enrollment) => !enrollment.claimToken),
    "Local claim tokens are not imported",
  );
  const owner = plan.rows.enrollment.find(
    (row) => row.id === plan.ownerEnrollmentId,
  );
  assert(
    owner?.status === "VERIFIED" && owner.userId === plan.ownerUserId,
    "Owner must be explicitly bound to the reviewed verified enrollment",
  );
  assert.equal(
    plan.rows.groupMember.filter((member) => member.isOwner).length,
    1,
  );
  assert(
    plan.rows.groupMember.some(
      (member) =>
        member.isOwner &&
        member.userId === owner.userId &&
        member.groupId === owner.groupId,
    ),
  );
  for (const name of order) {
    assert(Array.isArray(plan.rows[name]), `Missing reviewed model ${name}`);
    assert.equal(
      new Set(plan.rows[name].map((row) => row.id)).size,
      plan.rows[name].length,
      `Duplicate IDs in ${name}`,
    );
    const model = models.find((model) => nameOf(model) === name);
    const fields = new Map(
      model.fields
        .filter((field) => field.kind !== "object")
        .map((field) => [field.name, field]),
    );
    for (const row of plan.rows[name]) {
      for (const [key, value] of Object.entries(row)) {
        const field = fields.get(key);
        assert(field, `Unexpected imported field ${name}.${key}`);
        if (value === null) continue;
        if (field.type === "DateTime") {
          assert(typeof value === "string" && !Number.isNaN(Date.parse(value)));
          row[key] = new Date(value);
        }
        if (field.type === "BigInt") row[key] = BigInt(value.$bigint);
      }
    }
  }
  return { plan, digest };
}

/** Trusted, create-only initial transfer. No mutation of the source DB and no upserts. */
export async function applyReviewedImport(client, plan, digest) {
  return client.$transaction(
    async (tx) => {
      // Guard every model, including identities/sessions not present in the manifest.
      // A retry after success is a no-op, even after students have made real progress.
      await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(1984, 102)");
      const marker = await tx.auditLog.findUnique({
        where: { id: "initial-reviewed-import-v1" },
      });
      if (marker) {
        assert.equal(
          marker.details.manifestSha256,
          digest,
          "A different initial import has already been applied",
        );
        return { alreadyApplied: true };
      }
      for (const model of models) {
        assert.equal(
          await tx[nameOf(model)].count(),
          0,
          "Initial import requires a completely empty application database",
        );
      }
      const counts = {};
      for (const name of order) {
        const rows = plan.rows[name];
        // Preserve the recorded history; insert predecessors before rescheduled deadlines.
        if (name === "deadline") {
          const pending = new Map(rows.map((row) => [row.id, row]));
          while (pending.size) {
            const ready = [...pending.values()].filter(
              (row) =>
                !row.originalDeadlineId || !pending.has(row.originalDeadlineId),
            );
            assert(ready.length, "Cyclic deadline history in import");
            await tx.deadline.createMany({ data: ready });
            for (const row of ready) pending.delete(row.id);
          }
        } else if (rows.length) {
          await tx[name].createMany({ data: rows });
        }
        assert.equal(
          await tx[name].count(),
          rows.length,
          `Import count mismatch: ${name}`,
        );
        counts[name] = rows.length;
      }
      assert.equal(await tx.authIdentity.count(), 0);
      assert.equal(await tx.session.count(), 0);
      await tx.auditLog.create({
        data: {
          id: "initial-reviewed-import-v1",
          action: "REVIEWED_PRODUCTION_IMPORT",
          entityType: "GROUP",
          entityId: plan.rows.studyGroup[0].id,
          details: {
            groupId: plan.rows.studyGroup[0].id,
            manifestSha256: digest,
            sourceSha256: plan.sourceSha256,
            counts,
            exclusions: plan.exclusions,
            transformations: plan.transformations,
            operator: "TRUSTED_RELEASE",
          },
        },
      });
      return { alreadyApplied: false, counts };
    },
    { isolationLevel: "Serializable", maxWait: 15000, timeout: 120000 },
  );
}
