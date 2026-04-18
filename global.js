console.log("IT'S ALIVE!");

function $$(selector, context = document) {
  return Array.from(context.querySelectorAll(selector));
}

const pages = [
  { url: "", title: "Home" },
  { url: "projects/", title: "Projects" },
  { url: "contact/", title: "Contact" },
  { url: "resume/", title: "Resume" },
  { url: "https://github.com/siyasathaye", title: "Profile" },
];

const BASE_PATH =
  location.hostname === "localhost" || location.hostname === "127.0.0.1"
    ? "/"
    : "/portfolio/";

document.body.insertAdjacentHTML(
  "afterbegin",
  `
    <label class="color-scheme">
      Theme:
      <select>
        <option value="light dark">Automatic</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </label>
  `,
);

const nav = document.createElement("nav");
nav.className = "menu";
document.body.prepend(nav);

for (const p of pages) {
  let url = p.url;
  url = !url.startsWith("http") ? BASE_PATH + url : url;

  const a = document.createElement("a");
  a.href = url;
  a.textContent = p.title;
  if (a.host === location.host && a.pathname === location.pathname) {
    a.classList.add("current");
  }
  if (a.host !== location.host) {
    a.target = "_blank";
  }
  nav.append(a);
}

const select = document.querySelector(".color-scheme select");

function setColorScheme(colorScheme) {
  document.documentElement.style.setProperty("color-scheme", colorScheme);
  select.value = colorScheme;
}

if ("colorScheme" in localStorage) {
  setColorScheme(localStorage.colorScheme);
}

select.addEventListener("input", (event) => {
  const colorScheme = event.target.value;
  setColorScheme(colorScheme);
  localStorage.colorScheme = colorScheme;
});
