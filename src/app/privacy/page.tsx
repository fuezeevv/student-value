export default function PrivacyPage() {
  return (
    <article className="max-w-2xl mx-auto py-8 sm:py-14 space-y-6">
      <p className="eyebrow">Student Value 1.984</p>
      <h1 className="page-title">Данные и доступ</h1>
      <p className="page-intro">
        Учебные пространства студенческих групп. Доступ к записям группы
        получают её участники по персональному приглашению.
      </p>
      <section>
        <h2 className="text-xl mb-3">Вход через Google</h2>
        <p className="text-slate-300 leading-relaxed">
          Для входа используются идентификатор аккаунта Google, подтверждённый
          email и имя. Google email не показывается участникам группы. Доступ к
          Drive, Календарю, письмам и контактам не запрашивается. Токены доступа
          Google не сохраняются.
        </p>
      </section>
      <section>
        <h2 className="text-xl mb-3">Учебные записи</h2>
        <p className="text-slate-300 leading-relaxed">
          Сервис хранит задания, источники, сроки, связь со списком группы и
          личный прогресс. Личные заметки доступны их автору. Доступ к
          персональным данным списка группы ограничен полномочиями на сервере.
          Подтверждение сдачи отделено от отметки студента о выполнении.
        </p>
      </section>
      <section>
        <h2 className="text-xl mb-3">Хранение и удаление</h2>
        <p className="text-slate-300 leading-relaxed">
          Приложение размещается на Vercel, база PostgreSQL — на Neon во
          Frankfurt. Cookie входа защищена от чтения JavaScript и действует до
          14 дней; выход отзывает сессию. Для исправления данных, отзыва доступа
          или удаления аккаунта обратись к старосте — владельцу этого
          пространства. Учебные источники и история подтверждений могут
          сохраняться без связи с удалённым аккаунтом.
        </p>
      </section>
      <p className="text-sm text-slate-400">
        Сервис не является официальной информационной системой университета.
      </p>
      <a href="/login" className="text-blue-300 underline">
        Вернуться ко входу
      </a>
    </article>
  );
}
