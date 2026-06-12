function renderNav() {
    const links = [
        { href: "index.html",       label: "Table" },
        { href: "fixtures.html",    label: "Fixtures" },
        { href: "stats.html",       label: "Stats" },
        { href: "discipline.html",  label: "Discipline" },
        { href: "cleansheets.html", label: "Clean Sheets" },
    ];

    const raw = location.pathname.split("/").pop();
    const current = (raw === "" || raw === "/") ? "index.html" : raw;

    const html = links.map(l => `
        <a href="${l.href}" class="nav-link ${l.href === current ? 'active' : ''}"
           onclick="event.preventDefault(); navigateWithCheck('${l.href}')">
            ${l.label}
        </a>
    `).join("");

    document.getElementById("nav").innerHTML = html;
}