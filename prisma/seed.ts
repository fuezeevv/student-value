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
  DeadlineProvenance,
  VerificationSource,
  StudentTaskProgressStatus,
} from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting Student Value 1.984 seed...");

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
    update: {
      name: "Группа 5130901/40102",
      department: "Институт компьютерных наук и кибербезопасности (ИКНК)",
      program: "09.03.01 Информатика и вычислительная техника",
    },
    create: {
      code: "5130901/40102",
      name: "Группа 5130901/40102",
      department: "Институт компьютерных наук и кибербезопасности (ИКНК)",
      program: "09.03.01 Информатика и вычислительная техника",
      calendarId: null,
    },
  });

  // 3. Roles and Permissions
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

  // 4. Users: Rasul (Owner/Headman) & Demo Student
  const devOwner = await prisma.user.upsert({
    where: { nickname: "rasul" },
    update: {
      bio: "Староста группы 5130901/40102 · СПбПУ",
      avatarUrl: "https://api.dicebear.com/7.x/bottts/svg?seed=rasul-batukaev",
    },
    create: {
      id: "user-dev-owner",
      nickname: "rasul",
      avatarUrl: "https://api.dicebear.com/7.x/bottts/svg?seed=rasul-batukaev",
      bio: "Староста группы 5130901/40102 · СПбПУ",
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
      email: "batukaev.rr@edu.spbstu.ru",
      metadata: { role: "headman" },
    },
  });

  const devStudent = await prisma.user.upsert({
    where: { nickname: "ivan_student" },
    update: {
      bio: "Студент группы 40102",
      avatarUrl: "https://api.dicebear.com/7.x/bottts/svg?seed=ivan-student",
    },
    create: {
      id: "user-dev-student",
      nickname: "ivan_student",
      avatarUrl: "https://api.dicebear.com/7.x/bottts/svg?seed=ivan-student",
      bio: "Студент группы 40102",
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

  // Memberships
  const ownerMember = await prisma.groupMember.upsert({
    where: { groupId_userId: { groupId: group.id, userId: devOwner.id } },
    update: { isOwner: true },
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
    update: { isOwner: false },
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

  // 5. Official Roster of Group 5130901/40102 (from attendance sheet)
  const officialStudents = [
    "Адонин Валерий Валерьевич",
    "Андреева Алиса Вадимовна",
    "Астафьев Даниил Вячеславович",
    "Бай Хаовэнь",
    "Батукаев Расул Русланович",
    "Бондарук Николай Андреевич",
    "Буздаев Роберт Алексеевич",
    "Валтышев Даниил Денисович",
    "Вишневский Евфимий Антонович",
    "Галимов Айдар Фидаелович",
    "Гармажапов Жаргал Аюрович",
    "Дмитриевский Михаил Николаевич",
    "Зохиров Манучехр Фаррухович",
    "Кононенко Тимофей Степанович",
    "Краснов Роман Алексеевич",
    "Лахмери Скандер",
    "Митюнин Егор Дмитриевич",
    "Оздоев Адам Магомет-Амирович",
    "Рахимкулова Рената Шавкатовна",
    "Ребик Никита Владимирович",
    "Рзаев Тамерлан Абульфат Оглы",
    "Саидов Саиджон Сохибназарович",
    "Сорокин Никита Денисович",
    "Тимофеенко Сергей Владимирович",
    "Тимохин Дмитрий Эдуардович",
    "Ульянов Ярослав Алексеевич",
    "Фомченков Георгий Андреевич",
    "Шестоперов Ярослав Александрович",
    "Юдин Олег Вадимович",
    "Ярощенко Игорь Евгеньевич",
  ];

  // Remove legacy demo enrollments
  await prisma.enrollment.deleteMany({
    where: {
      groupId: group.id,
      fullName: { contains: "[DEMO]" },
    },
  });

  let ownerEnrollmentId = "";

  for (let i = 0; i < officialStudents.length; i++) {
    const fullName = officialStudents[i];
    const isRasul = fullName === "Батукаев Расул Русланович";

    const enrollment = await prisma.enrollment.upsert({
      where: {
        groupId_fullName: {
          groupId: group.id,
          fullName,
        },
      },
      update: {
        userId: isRasul ? devOwner.id : null,
        status: isRasul ? EnrollmentStatus.VERIFIED : EnrollmentStatus.PENDING_CLAIM,
        subgroup: null, // Source roster has no subgroup division
        studentIdNumber: null, // No official student ID numbers in source sheet
      },
      create: {
        groupId: group.id,
        userId: isRasul ? devOwner.id : null,
        fullName,
        subgroup: null,
        studentIdNumber: null,
        status: isRasul ? EnrollmentStatus.VERIFIED : EnrollmentStatus.PENDING_CLAIM,
      },
    });

    if (isRasul) {
      ownerEnrollmentId = enrollment.id;
    }
  }

  // 6. Teachers
  const teacherNesterov = await prisma.teacher.upsert({
    where: { id: "teacher-nesterov" },
    update: { fullName: "Нестеров Сергей Александрович", notes: "Основы теории управления (лекции и лабораторные работы)" },
    create: {
      id: "teacher-nesterov",
      fullName: "Нестеров Сергей Александрович",
      notes: "Основы теории управления (лекции и лабораторные работы)",
    },
  });

  const teacherTsygan = await prisma.teacher.upsert({
    where: { id: "teacher-tsygan" },
    update: { email: "tsygan1412@yandex.ru" },
    create: {
      id: "teacher-tsygan",
      fullName: "Цыган Владимир Николаевич",
      email: "tsygan1412@yandex.ru",
      notes: "Формальные грамматики и теория компиляторов",
    },
  });

  const teacherTarasov = await prisma.teacher.upsert({
    where: { id: "teacher-tarasov" },
    update: { fullName: "Тарасов", notes: "Архитектура процессоров и вычислительных систем (инициалы не указаны в источнике)" },
    create: {
      id: "teacher-tarasov",
      fullName: "Тарасов",
      notes: "Архитектура процессоров и вычислительных систем (инициалы не указаны в источнике)",
    },
  });

  const teacherSemenov = await prisma.teacher.upsert({
    where: { id: "teacher-semenov" },
    update: {},
    create: {
      id: "teacher-semenov",
      fullName: "Семенов Константин Константинович",
      notes: "Статистическая обработка больших данных (кандидат, статус: Оспаривается)",
    },
  });

  const teacherKadrgulov = await prisma.teacher.upsert({
    where: { id: "teacher-kadrgulov" },
    update: { fullName: "Кадргулов Расул Расилевич" },
    create: {
      id: "teacher-kadrgulov",
      fullName: "Кадргулов Расул Расилевич",
      notes: "Статистическая обработка больших данных (указан в титульном листе расчетной работы)",
    },
  });

  const teacherBolsunovskaya = await prisma.teacher.upsert({
    where: { id: "teacher-bolsunovskaya" },
    update: { fullName: "Болсуновская Марина Владимировна" },
    create: {
      id: "teacher-bolsunovskaya",
      fullName: "Болсуновская Марина Владимировна",
      notes: "Инженерная и компьютерная графика / VR",
    },
  });

  const teacherSushnikov = await prisma.teacher.upsert({
    where: { id: "teacher-sushnikov" },
    update: { fullName: "Сушников Виктор Александрович" },
    create: {
      id: "teacher-sushnikov",
      fullName: "Сушников Виктор Александрович",
      notes: "Математическое моделирование физических процессов",
    },
  });

  const teacherKulyashova = await prisma.teacher.upsert({
    where: { id: "teacher-kulyashova" },
    update: { notes: "Образовательный форсайт (инициалы не указаны в источнике)" },
    create: {
      id: "teacher-kulyashova",
      fullName: "Куляшова",
      notes: "Образовательный форсайт (инициалы не указаны в источнике)",
    },
  });

  const teacherSidnev = await prisma.teacher.upsert({
    where: { id: "teacher-sidnev" },
    update: { notes: "Системный анализ и принятие решений (инициалы не указаны в источнике)" },
    create: {
      id: "teacher-sidnev",
      fullName: "Сиднев",
      notes: "Системный анализ и принятие решений (инициалы не указаны в источнике)",
    },
  });

  // 7. Course Offerings
  const coursesData = [
    {
      code: "OTU",
      title: "Основы теории управления",
      shortTitle: "ОТУ",
      software: "MATLAB / Simulink",
      format: "Очный (лекции, лабораторные работы)",
      teachers: [{ teacher: teacherNesterov, role: "Лектор / Лабораторные", status: TeacherCourseStatus.CONFIRMED }],
    },
    {
      code: "COMPILERS",
      title: "Формальные грамматики и теория компиляторов",
      shortTitle: "Компиляторы",
      software: "Linux, Flex/Lex, Bison/Yacc, GCC",
      format: "Очный (электронные отчеты на почту tsygan1412@yandex.ru)",
      teachers: [{ teacher: teacherTsygan, role: "Лектор / Лабораторные", status: TeacherCourseStatus.CONFIRMED }],
    },
    {
      code: "FPGA",
      title: "Синтез и моделирование аппаратных средств вычислительных систем",
      shortTitle: "Синтез ВС",
      software: "Quartus Prime 18.1, Terasic DE10-Lite FPGA",
      format: "Очный (демонстрация проекта на плате)",
      teachers: [],
    },
    {
      code: "ARCH",
      title: "Архитектура процессоров",
      shortTitle: "Арх. процессоров",
      software: "TVBuilder, счетчик 1533ИЕ7",
      format: "Очный (лекции и практические занятия)",
      teachers: [{ teacher: teacherTarasov, role: "Преподаватель", status: TeacherCourseStatus.CONFIRMED }],
    },
    {
      code: "SOVD",
      title: "Статистическая обработка больших данных",
      shortTitle: "СОВД",
      software: "MATLAB / Python / R",
      format: "Очный / 2 расчетные работы (РЗ-1, РЗ-2)",
      teachers: [
        { teacher: teacherSemenov, role: "Преподаватель курса", status: TeacherCourseStatus.DISPUTED },
        { teacher: teacherKadrgulov, role: "Преподаватель курса", status: TeacherCourseStatus.DISPUTED },
      ],
    },
    {
      code: "GRAPHICS",
      title: "Инженерная и компьютерная графика / VR",
      shortTitle: "ИКГ / VR",
      software: "Blender (углубленно) / JavaScript OpenPolytech (дистанционно)",
      format: "Две траектории: Стандартная (дистанционно) или Углубленная (очно Blender)",
      teachers: [{ teacher: teacherBolsunovskaya, role: "Преподаватель", status: TeacherCourseStatus.CONFIRMED }],
    },
    {
      code: "MMPP",
      title: "Математическое моделирование физических процессов",
      shortTitle: "ММФП",
      software: "Математические пакеты",
      format: "Лекции и лабораторные (моделирование физических процессов сенсоров и датчиков)",
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
      software: "MATLAB (Optgr.m)",
      format: "Задания по нелинейной безусловной и условной оптимизации",
      teachers: [{ teacher: teacherSidnev, role: "Лектор и практик", status: TeacherCourseStatus.CONFIRMED }],
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
  let sovdOfferingId = "";
  let cadOfferingId = "";
  let graphicsOfferingId = "";

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

    if (c.code === "OTU") otuOfferingId = offering.id;
    if (c.code === "SOVD") sovdOfferingId = offering.id;
    if (c.code === "CAD") cadOfferingId = offering.id;
    if (c.code === "GRAPHICS") graphicsOfferingId = offering.id;

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
          notes: t.status === TeacherCourseStatus.DISPUTED
            ? "Конфликт в университетских источниках: Семенов К.К. vs Кадргулов Р.Р."
            : null,
        },
      });
    }
  }

  // 8. Sources & Provenance
  const sourceManual = await prisma.source.upsert({
    where: { id: "src-otu-manual-2026" },
    update: {},
    create: {
      id: "src-otu-manual-2026",
      groupId: group.id,
      type: SourceType.OFFICIAL_DOCUMENT,
      title: "С.А. Нестеров, «Основы теории управления», 2026",
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
      title: "Методические указания к лабораторным работам 1-9 по ОТУ",
      teacherId: teacherNesterov.id,
    },
  });

  const sourceCadDoc = await prisma.source.upsert({
    where: { id: "src-cad-schedule-doc" },
    update: {},
    create: {
      id: "src-cad-schedule-doc",
      groupId: group.id,
      type: SourceType.OFFICIAL_DOCUMENT,
      title: "Ведомость САПР упр. 5130901/40102 (пн 12:00-14:00, 3-402)",
      documentMetadata: { room: "3-402", dayOfWeek: "Monday", time: "12:00-14:00" },
    },
  });

  const sourceVrTranscript = await prisma.source.upsert({
    where: { id: "src-vr-intro-transcript" },
    update: {},
    create: {
      id: "src-vr-intro-transcript",
      groupId: group.id,
      type: SourceType.TRANSCRIPT_SEGMENT,
      title: "07-09 Графика VR Вводное занятие Болсуновская М.В.",
      teacherId: teacherBolsunovskaya.id,
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

  const refSovd1 = await prisma.sourceReference.upsert({
    where: { id: "ref-sovd-calc1" },
    update: {},
    create: {
      id: "ref-sovd-calc1",
      sourceId: sourceManual.id,
      entityType: "TASK",
      entityId: "task-sovd-calc1",
      quoteText: "Расчетное задание 1: Первичная обработка и оценивание числовых характеристик выборки.",
      confidence: ConfidenceLevel.CONFIRMED,
      createdById: devOwner.id,
    },
  });

  // 9. Real Tasks and Verified Deadlines
  // OTU Lab 1
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

  // Variant 4 for OTU Lab 1
  const var4Otu = await prisma.taskVariant.upsert({
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
        taskVariantId: var4Otu.id,
        enrollmentId: ownerEnrollmentId,
      },
    },
    update: {},
    create: {
      taskVariantId: var4Otu.id,
      enrollmentId: ownerEnrollmentId,
      assignedBy: "HEADMAN",
    },
  });

  // Active deadline for OTU Lab 1: End of October 2026
  await prisma.deadline.upsert({
    where: { id: "dl-otu-lab1" },
    update: {
      date: new Date("2026-10-25T23:59:00+03:00"),
      provenance: DeadlineProvenance.TEACHER,
    },
    create: {
      id: "dl-otu-lab1",
      taskId: taskLab1.id,
      courseOfferingId: otuOfferingId,
      title: "Срок сдачи ЛР1",
      type: DeadlineType.HARD,
      provenance: DeadlineProvenance.TEACHER,
      date: new Date("2026-10-25T23:59:00+03:00"),
      isTimeStrict: false,
      status: DeadlineStatus.ACTIVE,
      createdById: devOwner.id,
    },
  });

  // Progress for Rasul: Real actual state (Not started, unverified)
  await prisma.studentTaskProgress.upsert({
    where: { taskId_userId: { taskId: taskLab1.id, userId: devOwner.id } },
    update: {
      status: StudentTaskProgressStatus.NOT_STARTED,
      isVerified: false,
      verificationSource: null,
      studentNotes: null,
      submittedAt: null,
      acceptedAt: null,
    },
    create: {
      taskId: taskLab1.id,
      userId: devOwner.id,
      taskVariantId: var4Otu.id,
      status: StudentTaskProgressStatus.NOT_STARTED,
      isVerified: false,
    },
  });

  // Progress for Demo Student (In Progress for UI verification)
  await prisma.studentTaskProgress.upsert({
    where: { taskId_userId: { taskId: taskLab1.id, userId: devStudent.id } },
    update: {},
    create: {
      taskId: taskLab1.id,
      userId: devStudent.id,
      taskVariantId: var4Otu.id,
      status: StudentTaskProgressStatus.IN_PROGRESS,
      isVerified: false,
    },
  });

  // SOVD Calculation Task 1
  const taskSovd1 = await prisma.task.upsert({
    where: { id: "task-sovd-calc1" },
    update: {},
    create: {
      id: "task-sovd-calc1",
      courseOfferingId: sovdOfferingId,
      title: "РЗ №1: Первичная обработка и оценивание параметров распределения",
      description: "Построение вариационного ряда, эмпирической функции распределения, гистограммы частот, вычисление выборочного среднего, дисперсии и доверительных интервалов.",
      type: TaskType.CALCULATION_WORK,
      number: 1,
      status: TaskStatus.PUBLISHED,
      sourceReferenceId: refSovd1.id,
      createdById: devOwner.id,
      updatedById: devOwner.id,
    },
  });

  await prisma.taskAudience.upsert({
    where: { id: "aud-sovd-calc1" },
    update: {},
    create: {
      id: "aud-sovd-calc1",
      taskId: taskSovd1.id,
      targetType: TaskAudienceType.GROUP,
      groupId: group.id,
    },
  });

  // Variant 5 for SOVD (from variant_05.txt)
  const var5Sovd = await prisma.taskVariant.upsert({
    where: { taskId_variantNumber: { taskId: taskSovd1.id, variantNumber: "Вар. 5" } },
    update: {},
    create: {
      taskId: taskSovd1.id,
      variantNumber: "Вар. 5",
      title: "Вариант 5 (соответствует номеру в списке группы)",
      spec: {
        studentNumber: 5,
        datasetFile: "variant_05.txt",
        sampleSize: 100,
      },
    },
  });

  await prisma.variantAssignment.upsert({
    where: {
      taskVariantId_enrollmentId: {
        taskVariantId: var5Sovd.id,
        enrollmentId: ownerEnrollmentId,
      },
    },
    update: {},
    create: {
      taskVariantId: var5Sovd.id,
      enrollmentId: ownerEnrollmentId,
      assignedBy: "OFFICIAL_ROSTER",
    },
  });

  await prisma.deadline.upsert({
    where: { id: "dl-sovd-calc1" },
    update: {
      date: new Date("2026-11-05T23:59:00+03:00"),
      provenance: DeadlineProvenance.HEADMAN_CONFIRMED,
    },
    create: {
      id: "dl-sovd-calc1",
      taskId: taskSovd1.id,
      courseOfferingId: sovdOfferingId,
      title: "Рекомендуемый срок сдачи РЗ-1",
      type: DeadlineType.SOFT,
      provenance: DeadlineProvenance.HEADMAN_CONFIRMED,
      date: new Date("2026-11-05T23:59:00+03:00"),
      isTimeStrict: false,
      status: DeadlineStatus.ACTIVE,
      createdById: devOwner.id,
    },
  });

  // Rasul: Real actual state (Not started, unverified)
  await prisma.studentTaskProgress.upsert({
    where: { taskId_userId: { taskId: taskSovd1.id, userId: devOwner.id } },
    update: {
      status: StudentTaskProgressStatus.NOT_STARTED,
      isVerified: false,
      verificationSource: null,
      studentNotes: null,
      submittedAt: null,
      acceptedAt: null,
    },
    create: {
      taskId: taskSovd1.id,
      userId: devOwner.id,
      taskVariantId: var5Sovd.id,
      status: StudentTaskProgressStatus.NOT_STARTED,
      isVerified: false,
    },
  });

  // VR Track Choice Task
  const taskVrTrack = await prisma.task.upsert({
    where: { id: "task-vr-track-choice" },
    update: {},
    create: {
      id: "task-vr-track-choice",
      courseOfferingId: graphicsOfferingId,
      title: "Выбор траектории обучения: Дистанционная (Open Education) или Очная (Blender)",
      description: "Определиться с траекторией освоения курса: 1) Стандартная (дистанционный курс Открытого Политеха, моделирование на JS, консультации) или 2) Углубленная (очные занятия в лаборатории, 3D-моделирование в Blender).",
      type: TaskType.PRACTICAL,
      number: 1,
      status: TaskStatus.PUBLISHED,
      createdById: devOwner.id,
      updatedById: devOwner.id,
    },
  });

  await prisma.deadline.upsert({
    where: { id: "dl-vr-choice" },
    update: {
      date: new Date("2026-10-31T23:59:00+03:00"),
      provenance: DeadlineProvenance.TEACHER,
    },
    create: {
      id: "dl-vr-choice",
      taskId: taskVrTrack.id,
      courseOfferingId: graphicsOfferingId,
      title: "Срок выбора траектории в СДО",
      type: DeadlineType.SOFT,
      provenance: DeadlineProvenance.TEACHER,
      date: new Date("2026-10-31T23:59:00+03:00"),
      isTimeStrict: false,
      status: DeadlineStatus.ACTIVE,
      createdById: devOwner.id,
    },
  });

  // 10. Announcements
  await prisma.announcement.upsert({
    where: { id: "ann-cad-schedule-verified" },
    update: {},
    create: {
      id: "ann-cad-schedule-verified",
      groupId: group.id,
      courseOfferingId: cadOfferingId,
      title: "САПР: Аудитория 3-402 и время занятий",
      content: "Согласно официальной ведомости упражнений, занятия по САПР проходят каждый понедельник с 12:00 до 14:00 в аудитории 3-402.",
      isPinned: true,
      priority: "HIGH",
      authorId: devOwner.id,
    },
  });

  await prisma.announcement.upsert({
    where: { id: "ann-sovd-variants" },
    update: {},
    create: {
      id: "ann-sovd-variants",
      groupId: group.id,
      courseOfferingId: sovdOfferingId,
      title: "СОВД: Распределение вариантов к расчетным заданиям",
      content: "Номер варианта к Расчетному заданию №1 строго соответствует порядковому номеру студента в официальном списке группы 5130901/40102.",
      isPinned: false,
      priority: "NORMAL",
      authorId: devOwner.id,
    },
  });

  // 11. Gamification Rules & Achievements
  const xpRules = [
    { code: "TASK_SUBMISSION", name: "Отправка задания на проверку", points: 50, description: "Начисляется при переходе статуса в SUBMITTED" },
    { code: "TASK_ACCEPTED", name: "Подтвержденный зачет", points: 100, description: "Начисляется при подтверждении сдачи (ACCEPTED)" },
    { code: "FIRST_LAB_ACCEPTED", name: "Первая сданная лабораторная", points: 150, description: "Бонус за первую принятую работу в семестре" },
    { code: "ON_TIME_COMPLETION", name: "Сдача точно в срок", points: 50, description: "Бонус за сдачу до наступления hard-дедлайна" },
  ];

  for (const r of xpRules) {
    await prisma.xpRule.upsert({
      where: { code: r.code },
      update: { name: r.name, points: r.points, description: r.description },
      create: r,
    });
  }

  const achievements = [
    { code: "FIRST_STEP", title: "Первый шаг", description: "Отправьте первое задание на проверку", badgeIcon: "footprints", points: 50, category: "COMPLETION" },
    { code: "ACCEPTED_MASTER", title: "Зачет в кармане", description: "Получите подтвержденную преподавателем работу", badgeIcon: "check-circle", points: 100, category: "ACADEMIC" },
    { code: "DEADLINE_HERO", title: "Владыка дедлайнов", description: "Сдайте работу до наступления контрольного срока", badgeIcon: "clock", points: 75, category: "COMPLETION" },
    { code: "POLYTECH_COMRADE", title: "Политехник 5130901", description: "Активируйте профиль в Student Value 1.984", badgeIcon: "shield", points: 50, category: "GENERAL" },
  ];

  for (const a of achievements) {
    await prisma.achievementDefinition.upsert({
      where: { code: a.code },
      update: { title: a.title, description: a.description, badgeIcon: a.badgeIcon, points: a.points },
      create: a,
    });
  }

  // Gamification profiles: Real actual initial state for Rasul (0 XP, no fake streaks)
  await prisma.userGamificationProfile.upsert({
    where: { userId: devOwner.id },
    update: { totalXp: 0, level: 1, currentStreak: 0, longestStreak: 0, lastActivityDate: null },
    create: {
      userId: devOwner.id,
      totalXp: 0,
      level: 1,
      currentStreak: 0,
      longestStreak: 0,
      isLeaderboardOptIn: true,
      lastActivityDate: null,
    },
  });

  // Remove any legacy fake XP events or achievements for Rasul
  await prisma.xpEvent.deleteMany({
    where: { userId: devOwner.id },
  });
  await prisma.userAchievement.deleteMany({
    where: { userId: devOwner.id },
  });

  // Demo Student: clearly marked for testing UI gamification features without polluting real academic data
  await prisma.userGamificationProfile.upsert({
    where: { userId: devStudent.id },
    update: { totalXp: 50, level: 1, currentStreak: 1, longestStreak: 1 },
    create: {
      userId: devStudent.id,
      totalXp: 50,
      level: 1,
      currentStreak: 1,
      longestStreak: 1,
      isLeaderboardOptIn: true,
      lastActivityDate: new Date(),
    },
  });

  await prisma.xpEvent.upsert({
    where: {
      userId_taskId_ruleCode: {
        userId: devStudent.id,
        taskId: taskLab1.id,
        ruleCode: "TASK_SUBMISSION",
      },
    },
    update: {},
    create: {
      userId: devStudent.id,
      taskId: taskLab1.id,
      ruleCode: "TASK_SUBMISSION",
      points: 50,
      reason: "[DEMO] Отправка первого отчета на проверку",
    },
  });

  await prisma.userAchievement.upsert({
    where: {
      userId_achievementCode: {
        userId: devStudent.id,
        achievementCode: "FIRST_STEP",
      },
    },
    update: {},
    create: {
      userId: devStudent.id,
      achievementCode: "FIRST_STEP",
    },
  });

  // 12. In-App Notifications
  await prisma.notification.upsert({
    where: { id: "notif-welcome-owner" },
    update: {},
    create: {
      id: "notif-welcome-owner",
      userId: devOwner.id,
      title: "Добро пожаловать в Student Value 1.984",
      message: "Платформа академической организации группы 5130901/40102 готова к работе.",
      type: "COURSE_UPDATE",
      link: "/",
      isRead: false,
    },
  });

  await prisma.notification.upsert({
    where: { id: "notif-cad-schedule" },
    update: {},
    create: {
      id: "notif-cad-schedule",
      userId: devOwner.id,
      title: "Подтверждена аудитория САПР",
      message: "Аудитория 3-402, понедельник 12:00-14:00 (упражнения).",
      type: "ANNOUNCEMENT",
      link: "/courses/offering-cad",
      isRead: false,
    },
  });

  // 13. AI Suggestion Review Queue
  await prisma.aiSuggestion.upsert({
    where: { id: "sug-vr-track" },
    update: {},
    create: {
      id: "sug-vr-track",
      sourceId: sourceVrTranscript.id,
      entityType: "TASK",
      title: "Выбор между стандартной (JS) и углубленной (Blender) траекторией ИКГ",
      confidence: 0.96,
      suggestedData: {
        course: "ИКГ / VR",
        teacher: "Болсуновская М.В.",
        type: "PRACTICAL",
        notes: "Преподаватель указала пройти голосование в СДО до следующей лекции",
      },
      status: "PENDING",
      reviewNotes: null,
      reviewedById: null,
      reviewedAt: null,
    },
  });

  await prisma.aiSuggestion.upsert({
    where: { id: "sug-sovd-variant" },
    update: {
      status: "PENDING",
      reviewNotes: null,
      reviewedById: null,
      reviewedAt: null,
    },
    create: {
      id: "sug-sovd-variant",
      sourceId: null,
      entityType: "TASK",
      title: "Привязка вариантов РЗ-1 по СОВД к номеру в списке",
      confidence: 0.98,
      suggestedData: {
        course: "СОВД",
        rule: "variant_number == student_roster_index",
        sourceFile: "variant_05.txt",
      },
      status: "PENDING",
      reviewNotes: null,
      reviewedById: null,
      reviewedAt: null,
    },
  });

  await prisma.aiSuggestion.upsert({
    where: { id: "sug-cad-room" },
    update: {
      status: "APPROVED",
    },
    create: {
      id: "sug-cad-room",
      sourceId: sourceCadDoc.id,
      entityType: "ANNOUNCEMENT",
      title: "Расписание САПР упр.: пн 12:00-14:00, ауд. 3-402",
      confidence: 0.99,
      suggestedData: {
        course: "САПР",
        room: "3-402",
        schedule: "Понедельник 12:00-14:00",
      },
      status: "APPROVED",
      reviewNotes: "Подтверждено документом САПР_упр_5130901.40102_full.docx",
      reviewedById: devOwner.id,
      reviewedAt: new Date(),
    },
  });

  console.log("✅ Student Value 1.984 seed completed successfully with verified 30-student roster!");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
