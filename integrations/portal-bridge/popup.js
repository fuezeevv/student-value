/* No network, cookies, persistent content scripts or background access. */
let snapshot = null;
const status = document.getElementById("status");
const read = document.getElementById("read");
const save = document.getElementById("save");
const preview = document.getElementById("preview");
read.addEventListener("click", async () => {
  read.disabled = true; save.hidden = true; preview.hidden = true; snapshot = null;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = new URL(tab.url || "");
    const routes = { "/science-and-education/recordbook/": "recordbook", "/science-and-education/study_plan/": "study-plan" };
    if (url.origin !== "https://my.spbstu.ru" || !routes[url.pathname] || url.search || url.hash)
      throw new Error("Откройте зачётку или учебный план на my.spbstu.ru и повторите.");
    const result = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => {
      const clean = (element) => (element?.innerText || "").replace(/\s+/g, " ").trim();
      const visible = (element) => element.getClientRects().length > 0;
      const table = [...document.querySelectorAll("table")].find((element) => visible(element) && /Дисциплина/i.test(clean(element.querySelector("thead"))));
      if (!table) return { error: "Таблица ещё не загрузилась. Дождитесь её появления в кабинете." };
      const columns = [...table.querySelectorAll("thead tr:last-child th")].map(clean);
      const rows = [...table.querySelectorAll("tbody tr")].filter(visible).map((row) => [...row.querySelectorAll("td")].map(clean)).filter((row) => row.length === columns.length);
      const filters = [...document.querySelectorAll(".select2-selection__rendered")].filter(visible).map(clean).filter(Boolean);
      const info = clean(document.querySelector(".dataTables_info, .dt-info"));
      return { columns, rows, context: [...filters, info].filter(Boolean).join(" · ").slice(0, 1000) };
    }});
    const data = result[0]?.result;
    if (!data || data.error) throw new Error(data?.error || "Таблица недоступна.");
    if (data.columns.length < 2 || data.columns.length > 16 || !data.rows.length || data.rows.length > 500)
      throw new Error("Нет строк или формат таблицы изменился. Ничего не сохранено.");
    snapshot = { version: 1, kind: routes[url.pathname], sourceUrl: url.origin + url.pathname, capturedAt: new Date().toISOString(), ...data };
    status.textContent = `Готово: ${data.rows.length} строк, ${data.columns.length} столбцов.`;
    preview.textContent = `${data.context}\nПервая дисциплина: ${data.rows[0][0]}. Файл содержит только выбранные строки текущей страницы, не всю историю.`;
    preview.hidden = false; save.hidden = false;
  } catch (error) { status.textContent = error.message || "Не удалось прочитать таблицу."; }
  finally { read.disabled = false; }
});
save.addEventListener("click", () => {
  if (!snapshot) return;
  const url = URL.createObjectURL(new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" }));
  const link = document.createElement("a"); link.href = url;
  link.download = `studentvalue-${snapshot.kind}-${snapshot.capturedAt.slice(0, 10)}.json`;
  link.click(); setTimeout(() => URL.revokeObjectURL(url), 30000);
});
