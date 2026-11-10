(function () {
  try {
    var t = localStorage.getItem("studentvalue-theme");
    var isDark = false;
    if (t === "dark") {
      isDark = true;
    } else if (t === "light") {
      isDark = false;
    } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      isDark = true;
    }
    var root = document.documentElement;
    if (isDark) {
      root.setAttribute("data-theme", "dark");
      root.classList.add("dark");
    } else {
      root.setAttribute("data-theme", "light");
      root.classList.remove("dark");
    }
  } catch (e) {}
})();
