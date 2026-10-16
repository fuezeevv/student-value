import type { PrismaClient } from "@prisma/client";
/** Create-only bootstrap. Never overwrite a student's progress or an edited fact. */
export async function bootstrap(p: PrismaClient) {
  const actor = await p.user.upsert({
    where: { id: "system-bootstrap" },
    update: {},
    create: { id: "system-bootstrap", nickname: "system_bootstrap" },
  });
  const group = await p.studyGroup.upsert({
    where: { code: "5130901/40102" },
    update: {},
    create: {
      code: "5130901/40102",
      name: "Группа 5130901/40102",
      department: "ИКНК",
      program: "09.03.01 Информатика и вычислительная техника",
    },
  });
  const semester = await p.semester.upsert({
    where: { id: "fall-2026" },
    update: {},
    create: {
      id: "fall-2026",
      name: "Осенний семестр 2026",
      number: 5,
      startDate: new Date("2026-09-01T00:00:00+03:00"),
      endDate: new Date("2027-01-31T23:59:59+03:00"),
      isCurrent: true,
    },
  });
  for (const name of ["Owner", "Student"])
    await p.role.upsert({
      where: { groupId_name: { groupId: group.id, name } },
      update: {},
      create: { groupId: group.id, name, isDefault: name === "Student" },
    });
  const courses = [
    ["OTU", "Основы теории управления", "ОТУ"],
    ["COMPILERS", "Формальные грамматики и теория компиляторов", "Компиляторы"],
    [
      "FPGA",
      "Синтез и моделирование аппаратных средств вычислительных систем",
      "Синтез ВС",
    ],
    ["ARCH", "Архитектура процессоров", "Арх. процессоров"],
    ["SOVD", "Статистическая обработка больших данных", "СОВД"],
    ["GRAPHICS", "Инженерная и компьютерная графика / VR", "ИКГ / VR"],
    ["MMPP", "Математическое моделирование физических процессов", "ММФП"],
    ["FORESIGHT", "Образовательный форсайт", "Форсайт"],
    ["SYS_ANALYSIS", "Системный анализ и принятие решений", "Системный анализ"],
    ["CAD", "САПР, часть 1, упражнения", "САПР"],
  ];
  for (const [code, title, shortTitle] of courses) {
    const def = await p.courseDefinition.upsert({
      where: { code },
      update: {},
      create: { code, title, shortTitle },
    });
    const o = await p.courseOffering.upsert({
      where: { id: `offering-${code.toLowerCase()}` },
      update: {},
      create: {
        id: `offering-${code.toLowerCase()}`,
        courseDefinitionId: def.id,
        semesterId: semester.id,
      },
    });
    await p.courseOfferingGroup.upsert({
      where: {
        courseOfferingId_groupId: { courseOfferingId: o.id, groupId: group.id },
      },
      update: {},
      create: { courseOfferingId: o.id, groupId: group.id },
    });
  }
  const source = await p.source.upsert({
    where: { id: "src-cad-schedule-doc" },
    update: {},
    create: {
      id: "src-cad-schedule-doc",
      groupId: group.id,
      type: "OFFICIAL_DOCUMENT",
      title: "САПР_упр_5130901.40102_full.docx",
      documentMetadata: {
        semester: "осень 2026",
        schedule: "понедельник 12.00–14.00, 3-402",
        section: "Дедлайны для приема/сдачи расчетного задания",
      },
    },
  });
  const exercises = [
    ["Моп", "2026-09-22"],
    ["Лин", "2026-10-13"],
    ["Бопт", "2026-10-27"],
    ["Уопт", "2026-11-10"],
    ["ВиГ", "2026-11-24"],
    ["Дин", "2026-12-08"],
  ];
  for (const [i, [title, date]] of exercises.entries()) {
    const id = `task-cad-ex-${i + 1}`;
    const dlId = `dl-cad-ex-${i + 1}`;
    const taskRef = await p.sourceReference.upsert({
      where: { id: `ref-${id}` },
      update: {},
      create: {
        id: `ref-${id}`,
        sourceId: source.id,
        entityType: "TASK",
        entityId: id,
        quoteText: `${i + 1}. ${title}. Дедлайн: ${date.slice(8)}.${date.slice(5, 7)}`,
        confidence: "CONFIRMED",
        createdById: actor.id,
      },
    });
    await p.task.upsert({
      where: { id },
      update: {},
      create: {
        id,
        courseOfferingId: "offering-cad",
        title: `САПР: ${title}`,
        type: "EXERCISE",
        number: i + 1,
        sourceReferenceId: taskRef.id,
        createdById: actor.id,
        updatedById: actor.id,
      },
    });
    await p.taskAudience.upsert({
      where: { id: `aud-${id}` },
      update: {},
      create: {
        id: `aud-${id}`,
        taskId: id,
        targetType: "GROUP",
        groupId: group.id,
      },
    });
    const dlRef = await p.sourceReference.upsert({
      where: { id: `ref-${dlId}` },
      update: {},
      create: {
        id: `ref-${dlId}`,
        sourceId: source.id,
        entityType: "DEADLINE",
        entityId: dlId,
        quoteText: `${title} — ${date.slice(8)}.${date.slice(5, 7)}; ведомость «осень 2026»`,
        confidence: "CONFIRMED",
        createdById: actor.id,
      },
    });
    // No updates here: rerunning a seed must preserve a headman's rescheduled deadline.
    await p.deadline.upsert({
      where: { id: dlId },
      update: {},
      create: {
        id: dlId,
        taskId: id,
        courseOfferingId: "offering-cad",
        date: new Date(`${date}T23:59:59.999+03:00`),
        isTimeStrict: false,
        type: "HARD",
        provenance: "OFFICIAL",
        sourceReferenceId: dlRef.id,
        createdById: actor.id,
      },
    });
  }
}
