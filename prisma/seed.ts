import {
  PrismaClient,
  AuthProvider,
  EnrollmentStatus,
  SourceType,
  ConfidenceLevel,
  TeacherCourseStatus,
  TaskType,
  TaskStatus,
  TaskAudienceType,
  DeadlineType,
  DeadlineStatus,
  StudentTaskProgressStatus,
} from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting seed...");

  // 1. Semester: Fall 2026 (5 semester)
  const semester = await prisma.semester.upsert({
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

  // 2. Study Group: 5130901/40102
  const group = await prisma.studyGroup.upsert({
    where: { code: "5130901/40102" },
    update: {},
    create: {
      code: "5130901/40102",
      name: "Группа 5130901/40102",
      department: "ИКНК (Институт компьютерных наук и кибербезопасности)",
      program: "09.03.01 Информатика и вычислительная техника",
      calendarId: null, // Google Calendar ID will be connected later
    },
  });

  // 3. Roles and Permissions for Group 40102
  const ownerRole = await prisma.role.upsert({
    where: { groupId_name: { groupId: group.id, name: "Owner" } },
    update: {},
    create: {
      groupId: group.id,
      name: "Owner",
      isDefault: false,
    },
  });

  const studentRole = await prisma.role.upsert({
    where: { groupId_name: { groupId: group.id, name: "Student" } },
    update: {},
    create: {
      groupId: group.id,
      name: "Student",
      isDefault: true,
    },
  });

  const allPermissions = [
    "manage_group",
    "manage_members",
    "view_private_member_identity",
    "manage_roles",
    "manage_courses",
    "manage_tasks",
    "manage_deadlines",
    "manage_materials",
    "manage_announcements",
    "verify_progress",
  ];

  for (const perm of allPermissions) {
    await prisma.rolePermission.upsert({
      where: { roleId_permission: { roleId: ownerRole.id, permission: perm } },
      update: {},
      create: { roleId: ownerRole.id, permission: perm },
    });
  }

  // 4. Users: dev-owner (Rasul) and dev-student
  const devOwner = await prisma.user.upsert({
    where: { nickname: "rasul" },
    update: {},
    create: {
      id: "user-dev-owner",
      nickname: "rasul",
      avatarUrl: "https://api.dicebear.com/7.x/bottts/svg?seed=rasul",
      bio: "Староста группы 5130901/40102",
      isSystemAdmin: true,
    },
  });

  await prisma.authIdentity.upsert({
    where: {
      provider_providerUserId: {
        provider: AuthProvider.LOCAL_DEV,
        providerUserId: "dev-owner-uid",
      },
    },
    update: {},
    create: {
      userId: devOwner.id,
      provider: AuthProvider.LOCAL_DEV,
      providerUserId: "dev-owner-uid",
      email: null,
      metadata: { role: "headman" },
    },
  });

  const devStudent = await prisma.user.upsert({
    where: { nickname: "ivan_student" },
    update: {},
    create: {
      id: "user-dev-student",
      nickname: "ivan_student",
      avatarUrl: "https://api.dicebear.com/7.x/bottts/svg?seed=ivan",
      bio: "Студент группы 40102 [DEMO]",
      isSystemAdmin: false,
    },
  });

  await prisma.authIdentity.upsert({
    where: {
      provider_providerUserId: {
        provider: AuthProvider.LOCAL_DEV,
        providerUserId: "dev-student-uid",
      },
    },
    update: {},
    create: {
      userId: devStudent.id,
      provider: AuthProvider.LOCAL_DEV,
      providerUserId: "dev-student-uid",
      email: null,
      metadata: { role: "student" },
    },
  });

  // Group Memberships
  const ownerMember = await prisma.groupMember.upsert({
    where: { groupId_userId: { groupId: group.id, userId: devOwner.id } },
    update: {},
    create: {
      groupId: group.id,
      userId: devOwner.id,
      isOwner: true,
    },
  });

  await prisma.userGroupRole.upsert({
    where: {
      groupMemberId_roleId: {
        groupMemberId: ownerMember.id,
        roleId: ownerRole.id,
      },
    },
    update: {},
    create: {
      groupMemberId: ownerMember.id,
      roleId: ownerRole.id,
    },
  });

  const studentMember = await prisma.groupMember.upsert({
    where: { groupId_userId: { groupId: group.id, userId: devStudent.id } },
    update: {},
    create: {
      groupId: group.id,
      userId: devStudent.id,
      isOwner: false,
    },
  });

  await prisma.userGroupRole.upsert({
    where: {
      groupMemberId_roleId: {
        groupMemberId: studentMember.id,
        roleId: studentRole.id,
      },
    },
    update: {},
    create: {
      groupMemberId: studentMember.id,
      roleId: studentRole.id,
    },
  });

  // 5. Enrollments (Academic Roster)
  const ownerEnrollment = await prisma.enrollment.upsert({
    where: {
      groupId_fullName: {
        groupId: group.id,
        fullName: "Батукаев Расул Русланович",
      },
    },
    update: { userId: devOwner.id, status: EnrollmentStatus.VERIFIED },
    create: {
      groupId: group.id,
      userId: devOwner.id,
      fullName: "Батукаев Расул Русланович",
      subgroup: 1,
      status: EnrollmentStatus.VERIFIED,
    },
  });

  const studentEnrollment = await prisma.enrollment.upsert({
    where: {
      groupId_fullName: {
        groupId: group.id,
        fullName: "Иванов Иван Иванович [DEMO]",
      },
    },
    update: { userId: devStudent.id, status: EnrollmentStatus.VERIFIED },
    create: {
      groupId: group.id,
      userId: devStudent.id,
      fullName: "Иванов Иван Иванович [DEMO]",
      subgroup: 1,
      status: EnrollmentStatus.VERIFIED,
    },
  });

  // 6. Teachers
  const teacherNesterov = await prisma.teacher.upsert({
    where: { id: "teacher-nesterov" },
    update: {},
    create: {
      id: "teacher-nesterov",
      fullName: "Нестеров С.А.",
      notes: "Основы теории управления, лекции и лабораторные",
    },
  });

  const teacherTsygan = await prisma.teacher.upsert({
    where: { id: "teacher-tsygan" },
    update: {},
    create: {
      id: "teacher-tsygan",
      fullName: "Цыган Владимир Николаевич",
      email: "tsygan1412@yandex.ru",
      notes: "Формальные грамматики и теория компиляторов",
    },
  });

  const teacherTarasov = await prisma.teacher.upsert({
    where: { id: "teacher-tarasov" },
    update: {},
    create: {
      id: "teacher-tarasov",
      fullName: "Тарасов",
      notes: "Архитектура процессоров, TVBuilder",
    },
  });

  const teacherSemenov = await prisma.teacher.upsert({
    where: { id: "teacher-semenov" },
    update: {},
    create: {
      id: "teacher-semenov",
      fullName: "Семенов Константин Константинович",
      notes: "Статистическая обработка больших данных (кандидат)",
    },
  });

  const teacherKadrgulov = await prisma.teacher.upsert({
    where: { id: "teacher-kadrgulov" },
    update: {},
    create: {
      id: "teacher-kadrgulov",
      fullName: "Кадргулов Расул Расилиевич",
      notes: "Статистическая обработка больших данных (кандидат, конфликт источников)",
    },
  });

  const teacherBolsunovskaya = await prisma.teacher.upsert({
    where: { id: "teacher-bolsunovskaya" },
    update: {},
    create: {
      id: "teacher-bolsunovskaya",
      fullName: "Болсуновская",
      notes: "Инженерная и компьютерная графика / VR",
    },
  });

  const teacherSushnikov = await prisma.teacher.upsert({
    where: { id: "teacher-sushnikov" },
    update: {},
    create: {
      id: "teacher-sushnikov",
      fullName: "Сушников В.А.",
      notes: "Математическое моделирование физических процессов",
    },
  });

  const teacherKulyashova = await prisma.teacher.upsert({
    where: { id: "teacher-kulyashova" },
    update: {},
    create: {
      id: "teacher-kulyashova",
      fullName: "Куляшова",
      notes: "Образовательный форсайт, мобильность",
    },
  });

  // 7. Course Definitions & Offerings
  const coursesData = [
    {
      code: "OTU",
      title: "Основы теории управления",
      shortTitle: "ОТУ",
      software: "MATLAB / Simulink",
      format: "Очный",
      teachers: [{ teacher: teacherNesterov, role: "Лектор / Лабораторные", status: TeacherCourseStatus.CONFIRMED }],
    },
    {
      code: "COMPILERS",
      title: "Формальные грамматики и теория компиляторов",
      shortTitle: "Компиляторы",
      software: "Linux, Flex/Lex, Bison/Yacc, GCC",
      format: "Очный (электронные отчеты)",
      teachers: [{ teacher: teacherTsygan, role: "Лектор / Лабораторные", status: TeacherCourseStatus.CONFIRMED }],
    },
    {
      code: "FPGA",
      title: "Синтез и моделирование аппаратных средств вычислительных систем",
      shortTitle: "Синтез ВС",
      software: "Quartus Prime 18.1, Terasic DE10-Lite",
      format: "Очный (демонстрация на плате)",
      teachers: [],
    },
    {
      code: "ARCH",
      title: "Архитектура процессоров",
      shortTitle: "Арх. процессоров",
      software: "TVBuilder, 1533ИЕ7",
      format: "Очный",
      teachers: [{ teacher: teacherTarasov, role: "Преподаватель", status: TeacherCourseStatus.CONFIRMED }],
    },
    {
      code: "SOVD",
      title: "Статистическая обработка больших данных",
      shortTitle: "СОВД",
      software: "MATLAB / Языки программирования",
      format: "Очный / 2 расчетные работы",
      teachers: [
        { teacher: teacherSemenov, role: "Преподаватель курса", status: TeacherCourseStatus.DISPUTED },
        { teacher: teacherKadrgulov, role: "Преподаватель курса", status: TeacherCourseStatus.DISPUTED },
      ],
    },
    {
      code: "GRAPHICS",
      title: "Инженерная и компьютерная графика / VR",
      shortTitle: "ИКГ / VR",
      software: null,
      format: "Очный / Дистанционный по выбору",
      teachers: [{ teacher: teacherBolsunovskaya, role: "Преподаватель", status: TeacherCourseStatus.CONFIRMED }],
    },
    {
      code: "MMPP",
      title: "Математическое моделирование физических процессов",
      shortTitle: "ММФП",
      software: null,
      format: "Лекции и лабораторные",
      teachers: [{ teacher: teacherSushnikov, role: "Преподаватель", status: TeacherCourseStatus.CONFIRMED }],
    },
    {
      code: "FORESIGHT",
      title: "Образовательный форсайт",
      shortTitle: "Форсайт",
      software: null,
      format: "Модуль мобильности 3 курса (6 ЗЕ)",
      teachers: [{ teacher: teacherKulyashova, role: "Преподаватель", status: TeacherCourseStatus.CONFIRMED }],
    },
    {
      code: "SYS_ANALYSIS",
      title: "Системный анализ и принятие решений",
      shortTitle: "Системный анализ",
      software: null,
      format: "Задачи с вектором X и матрицей A",
      teachers: [],
    },
    {
      code: "CAD",
      title: "САПР, часть 1, упражнения",
      shortTitle: "САПР",
      software: "Расчетные упражнения",
      format: "Понедельник 12:00-14:00, ауд. 3-402",
      teachers: [],
    },
  ];

  let otuOfferingId = "";

  for (const c of coursesData) {
    const courseDef = await prisma.courseDefinition.upsert({
      where: { code: c.code },
      update: { title: c.title, shortTitle: c.shortTitle },
      create: { code: c.code, title: c.title, shortTitle: c.shortTitle },
    });

    const offering = await prisma.courseOffering.upsert({
      where: { id: `offering-${c.code.toLowerCase()}` },
      update: {
        softwareRequired: c.software,
        format: c.format,
      },
      create: {
        id: `offering-${c.code.toLowerCase()}`,
        courseDefinitionId: courseDef.id,
        semesterId: semester.id,
        softwareRequired: c.software,
        format: c.format,
      },
    });

    if (c.code === "OTU") {
      otuOfferingId = offering.id;
    }

    await prisma.courseOfferingGroup.upsert({
      where: {
        courseOfferingId_groupId: {
          courseOfferingId: offering.id,
          groupId: group.id,
        },
      },
      update: {},
      create: {
        courseOfferingId: offering.id,
        groupId: group.id,
      },
    });

    for (const t of c.teachers) {
      await prisma.courseTeacher.upsert({
        where: { id: `ct-${offering.id}-${t.teacher.id}` },
        update: { status: t.status },
        create: {
          id: `ct-${offering.id}-${t.teacher.id}`,
          courseOfferingId: offering.id,
          teacherId: t.teacher.id,
          role: t.role,
          status: t.status,
          notes: t.status === TeacherCourseStatus.DISPUTED ? "Конфликт в источниках: Семенов К.К. vs Кадргулов Р.Р." : null,
        },
      });
    }
  }

  // 8. Sources for OTU
  const sourceManual = await prisma.source.upsert({
    where: { id: "src-otu-manual-2026" },
    update: {},
    create: {
      id: "src-otu-manual-2026",
      groupId: group.id,
      type: SourceType.OFFICIAL_DOCUMENT,
      title: "С.А. Нестеров, «Основы теории управления», издание 2026",
      documentMetadata: { pages: "1-320", year: 2026 },
      teacherId: teacherNesterov.id,
    },
  });

  const sourceLabs = await prisma.source.upsert({
    where: { id: "src-otu-labs-guide" },
    update: {},
    create: {
      id: "src-otu-labs-guide",
      groupId: group.id,
      type: SourceType.OFFICIAL_DOCUMENT,
      title: "Методические указания к лабораторным работам 1-9 по дисциплине «Основы теории управления»",
      teacherId: teacherNesterov.id,
    },
  });

  const sourceLectureWords = await prisma.source.upsert({
    where: { id: "src-otu-lecture-1410" },
    update: {},
    create: {
      id: "src-otu-lecture-1410",
      groupId: group.id,
      type: SourceType.TEACHER_STATEMENT,
      title: "Указания Нестерова С.А. на лекции 14.10.2026",
      teacherId: teacherNesterov.id,
    },
  });

  // Source References
  const refLab1 = await prisma.sourceReference.upsert({
    where: { id: "ref-otu-lab1" },
    update: {},
    create: {
      id: "ref-otu-lab1",
      sourceId: sourceLabs.id,
      entityType: "TASK",
      entityId: "task-otu-lab1",
      quoteText: "Лабораторная работа №1. Изучение свойств объекта управления (ОУ) по математическому описанию вход-выход.",
      confidence: ConfidenceLevel.CONFIRMED,
      createdById: devOwner.id,
    },
  });

  const refLab4 = await prisma.sourceReference.upsert({
    where: { id: "ref-otu-lab4" },
    update: {},
    create: {
      id: "ref-otu-lab4",
      sourceId: sourceLectureWords.id,
      entityType: "TASK",
      entityId: "task-otu-lab4",
      quoteText: "По состоянию на 14 октября 2026 преподаватель еще не требовал начинать ЛР4.",
      confidence: ConfidenceLevel.CONFIRMED,
      createdById: devOwner.id,
    },
  });

  // 9. Tasks for OTU (Focus for Vertical Slice)
  const taskLab1 = await prisma.task.upsert({
    where: { id: "task-otu-lab1" },
    update: {},
    create: {
      id: "task-otu-lab1",
      courseOfferingId: otuOfferingId,
      title: "ЛР1: Изучение свойств объекта управления (ОУ) по математическому описанию вход-выход",
      description: "Построение переходных и импульсных характеристик ОУ в MATLAB/Simulink. Анализ показателей качества: перерегулирование, время нарастания, время регулирования.",
      type: TaskType.LABORATORY,
      number: 1,
      status: TaskStatus.PUBLISHED,
      sourceReferenceId: refLab1.id,
      createdById: devOwner.id,
      updatedById: devOwner.id,
    },
  });

  // Audience
  await prisma.taskAudience.upsert({
    where: { id: "aud-otu-lab1" },
    update: {},
    create: {
      id: "aud-otu-lab1",
      taskId: taskLab1.id,
      targetType: TaskAudienceType.GROUP,
      groupId: group.id,
    },
  });

  // Variants for Lab 1
  const var4 = await prisma.taskVariant.upsert({
    where: { taskId_variantNumber: { taskId: taskLab1.id, variantNumber: "Вар. 4" } },
    update: {},
    create: {
      taskId: taskLab1.id,
      variantNumber: "Вар. 4",
      title: "Вариант 4",
      spec: {
        k: 2.4,
        T1: 0.5,
        T2: 0.12,
        transferFunction: "W(s) = 2.4 / ((0.5*s + 1)(0.12*s + 1))",
      },
    },
  });

  await prisma.variantAssignment.upsert({
    where: {
      taskVariantId_enrollmentId: {
        taskVariantId: var4.id,
        enrollmentId: ownerEnrollment.id,
      },
    },
    update: {},
    create: {
      taskVariantId: var4.id,
      enrollmentId: ownerEnrollment.id,
      assignedBy: "HEADMAN",
    },
  });

  // Deadline for Lab 1
  await prisma.deadline.upsert({
    where: { id: "dl-otu-lab1" },
    update: {},
    create: {
      id: "dl-otu-lab1",
      taskId: taskLab1.id,
      courseOfferingId: otuOfferingId,
      title: "Срок сдачи ЛР1",
      type: DeadlineType.HARD,
      date: new Date("2026-09-20T23:59:00+03:00"),
      isTimeStrict: false,
      status: DeadlineStatus.ACTIVE,
      createdById: devOwner.id,
    },
  });

  // Progress for Rasul (Verified Accepted)
  await prisma.studentTaskProgress.upsert({
    where: { taskId_userId: { taskId: taskLab1.id, userId: devOwner.id } },
    update: {},
    create: {
      taskId: taskLab1.id,
      userId: devOwner.id,
      taskVariantId: var4.id,
      status: StudentTaskProgressStatus.ACCEPTED,
      isVerified: true,
      verifiedById: devOwner.id,
      verifiedAt: new Date("2026-09-26T14:30:00+03:00"),
      verificationSource: "Зачтено Нестеровым С.А. на занятии",
      studentNotes: "Модель в Simulink построена, отчет подписан",
    },
  });

  // Progress for Demo Student (Not started)
  await prisma.studentTaskProgress.upsert({
    where: { taskId_userId: { taskId: taskLab1.id, userId: devStudent.id } },
    update: {},
    create: {
      taskId: taskLab1.id,
      userId: devStudent.id,
      taskVariantId: var4.id,
      status: StudentTaskProgressStatus.NOT_STARTED,
      isVerified: false,
    },
  });

  // Task Lab 4: Not yet assigned by teacher
  const taskLab4 = await prisma.task.upsert({
    where: { id: "task-otu-lab4" },
    update: {},
    create: {
      id: "task-otu-lab4",
      courseOfferingId: otuOfferingId,
      title: "ЛР4: Частотный синтез системы управления по заданным требованиям",
      description: "Синтез регулятора по логарифмическим частотным характеристикам (ЛАЧХ и ЛФЧХ). ВНИМАНИЕ: По состоянию на 14.10.2026 преподаватель еще не выдавал требование приступать к работе.",
      type: TaskType.LABORATORY,
      number: 4,
      status: TaskStatus.PUBLISHED,
      sourceReferenceId: refLab4.id,
      createdById: devOwner.id,
      updatedById: devOwner.id,
    },
  });

  await prisma.taskAudience.upsert({
    where: { id: "aud-otu-lab4" },
    update: {},
    create: {
      id: "aud-otu-lab4",
      taskId: taskLab4.id,
      targetType: TaskAudienceType.GROUP,
      groupId: group.id,
    },
  });

  // Lab 4 has NO deadline (TBD / unknown)
  await prisma.studentTaskProgress.upsert({
    where: { taskId_userId: { taskId: taskLab4.id, userId: devOwner.id } },
    update: {},
    create: {
      taskId: taskLab4.id,
      userId: devOwner.id,
      status: StudentTaskProgressStatus.NOT_STARTED,
      isVerified: false,
    },
  });

  await prisma.studentTaskProgress.upsert({
    where: { taskId_userId: { taskId: taskLab4.id, userId: devStudent.id } },
    update: {},
    create: {
      taskId: taskLab4.id,
      userId: devStudent.id,
      status: StudentTaskProgressStatus.NOT_STARTED,
      isVerified: false,
    },
  });

  // Task: Homework 2 for OTU
  const taskHw2 = await prisma.task.upsert({
    where: { id: "task-otu-hw2" },
    update: {},
    create: {
      id: "task-otu-hw2",
      courseOfferingId: otuOfferingId,
      title: "Задание после лекции №2: Расчет передаточной функции замкнутой системы",
      description: "Выполнить аналитический расчет эквивалентной передаточной функции для структурной схемы из конспекта лекции №2.",
      type: TaskType.HOMEWORK,
      number: 2,
      status: TaskStatus.PUBLISHED,
      createdById: devOwner.id,
      updatedById: devOwner.id,
    },
  });

  await prisma.taskAudience.upsert({
    where: { id: "aud-otu-hw2" },
    update: {},
    create: {
      id: "aud-otu-hw2",
      taskId: taskHw2.id,
      targetType: TaskAudienceType.GROUP,
      groupId: group.id,
    },
  });

  // Soft deadline for HW2: 2026-10-22
  await prisma.deadline.upsert({
    where: { id: "dl-otu-hw2" },
    update: {},
    create: {
      id: "dl-otu-hw2",
      taskId: taskHw2.id,
      courseOfferingId: otuOfferingId,
      title: "Рекомендуемый срок выполнения ДЗ2",
      type: DeadlineType.SOFT,
      date: new Date("2026-10-22T23:59:00+03:00"),
      isTimeStrict: false,
      status: DeadlineStatus.ACTIVE,
      createdById: devOwner.id,
    },
  });

  await prisma.studentTaskProgress.upsert({
    where: { taskId_userId: { taskId: taskHw2.id, userId: devOwner.id } },
    update: {},
    create: {
      taskId: taskHw2.id,
      userId: devOwner.id,
      status: StudentTaskProgressStatus.IN_PROGRESS,
      isVerified: false,
    },
  });

  await prisma.studentTaskProgress.upsert({
    where: { taskId_userId: { taskId: taskHw2.id, userId: devStudent.id } },
    update: {},
    create: {
      taskId: taskHw2.id,
      userId: devStudent.id,
      status: StudentTaskProgressStatus.NOT_STARTED,
      isVerified: false,
    },
  });

  // 10. Announcements
  await prisma.announcement.upsert({
    where: { id: "ann-otu-lab4-info" },
    update: {},
    create: {
      id: "ann-otu-lab4-info",
      groupId: group.id,
      courseOfferingId: otuOfferingId,
      title: "ОТУ: Информация по началу ЛР4",
      content: "Нестеров С.А. сообщил на занятии, что приступать к ЛР4 пока не требуется. Методичка к ЛР1-ЛР3 остается актуальной. Не ориентируйтесь на старые графики сдачи.",
      isPinned: true,
      priority: "NORMAL",
      authorId: devOwner.id,
    },
  });

  console.log("✅ Seed completed successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
