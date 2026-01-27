(() => {
  const OWNER = "RadanPY";
  const REPO = "churomi-site";
  const BRANCH = "main";

  const PAGE_PATHS = {
    en: {
      home: "/index.html",
      privacy: "/privacy.html",
      terms: "/terms.html",
    },
    zh: {
      home: "/zh/index.html",
      privacy: "/zh/privacy.html",
      terms: "/zh/terms.html",
    },
  };

  const pageSelect = document.getElementById("pageSelect");
  const langSelect = document.getElementById("langSelect");
  const reloadBtn = document.getElementById("reloadBtn");
  const downloadBtn = document.getElementById("downloadBtn");
  const publishBtn = document.getElementById("publishBtn");
  const tokenInput = document.getElementById("tokenInput");
  const commitInput = document.getElementById("commitInput");
  const modulesRoot = document.getElementById("modules");
  const previewFrame = document.getElementById("previewFrame");
  const logEl = document.getElementById("log");

  let current = {
    lang: "en",
    page: "home",
    path: "/index.html",
    html: "",
    doc: null,
    fields: new Map(),
  };

  const escapeHtml = (value) =>
    String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");

  const safeBase64 = (str) => {
    const bytes = new TextEncoder().encode(str);
    let binary = "";
    bytes.forEach((b) => {
      binary += String.fromCharCode(b);
    });
    return btoa(binary);
  };

  const log = (line) => {
    const ts = new Date().toLocaleTimeString();
    logEl.textContent = `[${ts}] ${line}\n` + logEl.textContent;
  };

  const titleCase = (key) =>
    key
      .replaceAll("-", " ")
      .split(" ")
      .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
      .join(" ");

  const labelFromKey = (key) => {
    const parts = key.split(".");
    const pretty = parts
      .map((part) => {
        if (/^\d+$/.test(part)) return `[${part}]`;
        return part.replaceAll(/([A-Z])/g, " $1").trim();
      })
      .join(" ");
    return titleCase(pretty.replaceAll(/\s+/g, " ").trim());
  };

  const getSelectedPath = () => PAGE_PATHS[current.lang]?.[current.page] ?? "/index.html";

  const getRepoPath = () => {
    const path = getSelectedPath();
    return path.startsWith("/") ? path.slice(1) : path;
  };

  const parseHtml = (html) => new DOMParser().parseFromString(html, "text/html");

  const collectFields = (doc) => {
    const byKey = new Map();

    const add = (key, type, el) => {
      if (!key) return;
      const entry = byKey.get(key) ?? { key, type, elements: [], value: "" };
      entry.type = entry.type || type;
      entry.elements.push(el);
      byKey.set(key, entry);
    };

    doc.querySelectorAll("[data-edit]").forEach((el) => add(el.getAttribute("data-edit"), "text", el));
    doc.querySelectorAll("[data-edit-href]").forEach((el) =>
      add(el.getAttribute("data-edit-href"), "href", el),
    );
    doc.querySelectorAll("[data-edit-mailto]").forEach((el) =>
      add(el.getAttribute("data-edit-mailto"), "mailto", el),
    );

    for (const entry of byKey.values()) {
      const el = entry.elements[0];
      if (!el) continue;
      if (entry.type === "href") {
        entry.value = el.getAttribute("href") ?? "";
      } else if (entry.type === "mailto") {
        const href = el.getAttribute("href") ?? "";
        entry.value = href.startsWith("mailto:") ? href.slice("mailto:".length) : el.textContent.trim();
      } else {
        entry.value = el.textContent.trim();
      }
    }

    return byKey;
  };

  const applyFieldValue = (key, value) => {
    const entry = current.fields.get(key);
    if (!entry) return;

    if (entry.type === "href") {
      entry.elements.forEach((el) => el.setAttribute("href", value));
      entry.value = value;
      return;
    }

    if (entry.type === "mailto") {
      const email = value.trim();
      entry.elements.forEach((el) => {
        el.setAttribute("href", `mailto:${email}`);
        el.textContent = email;
      });
      entry.value = email;
      return;
    }

    entry.elements.forEach((el) => {
      el.textContent = value;
    });
    entry.value = value;
  };

  const buildHtml = () => {
    if (!current.doc) return "";
    const doctype = "<!doctype html>\n";
    return doctype + current.doc.documentElement.outerHTML + "\n";
  };

  const updatePreview = () => {
    if (!current.doc) return;
    const html = buildHtml();
    const baseHref = current.path.startsWith("/zh/") ? "/zh/" : "/";
    const srcdoc = html.replace("<head>", `<head>\n    <base href=\"${escapeHtml(baseHref)}\" />`);
    previewFrame.srcdoc = srcdoc;
  };

  const renderModules = () => {
    modulesRoot.innerHTML = "";

    const groups = new Map();
    for (const entry of current.fields.values()) {
      const groupKey = entry.key.split(".")[0] ?? "other";
      const list = groups.get(groupKey) ?? [];
      list.push(entry);
      groups.set(groupKey, list);
    }

    const sortedGroups = Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));

    for (const [groupKey, entries] of sortedGroups) {
      const details = document.createElement("details");
      details.className = "admin-module";
      details.open = true;

      const summary = document.createElement("summary");
      summary.textContent = titleCase(groupKey);
      details.appendChild(summary);

      const fieldRow = document.createElement("div");
      fieldRow.className = "admin-field-row";

      entries
        .sort((a, b) => a.key.localeCompare(b.key))
        .forEach((entry) => {
          const wrap = document.createElement("div");
          wrap.className = "admin-field";

          const label = document.createElement("label");
          label.textContent = labelFromKey(entry.key);
          wrap.appendChild(label);

          const isLong = entry.value.length > 90 || entry.value.includes("\n");
          const input = isLong ? document.createElement("textarea") : document.createElement("input");
          if (!isLong) input.type = "text";
          input.value = entry.value;

          input.addEventListener("input", () => {
            applyFieldValue(entry.key, input.value);
            updatePreview();
          });

          wrap.appendChild(input);

          const keyEl = document.createElement("div");
          keyEl.className = "admin-key";
          keyEl.textContent = entry.key;
          wrap.appendChild(keyEl);

          fieldRow.appendChild(wrap);
        });

      details.appendChild(fieldRow);
      modulesRoot.appendChild(details);
    }
  };

  const load = async () => {
    current.path = getSelectedPath();
    const url = `${location.origin}${current.path}?cb=${Date.now()}`;
    log(`Loading ${current.lang.toUpperCase()} / ${current.page} (${current.path})`);

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`Failed to load ${current.path}: ${res.status}`);
    }

    current.html = await res.text();
    current.doc = parseHtml(current.html);
    current.fields = collectFields(current.doc);

    if (current.fields.size === 0) {
      log("No editable modules found on this page (missing data-edit attributes).");
    } else {
      log(`Loaded ${current.fields.size} module fields.`);
    }

    renderModules();
    updatePreview();
  };

  const download = () => {
    const html = buildHtml();
    const filename = `churomi-${current.lang}-${current.page}-${new Date()
      .toISOString()
      .replaceAll(/[:.]/g, "-")}.html`;

    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    log(`Downloaded ${filename}`);
  };

  const gh = async (path, token, options = {}) => {
    const url = `https://api.github.com${path}`;
    const res = await fetch(url, {
      ...options,
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        Authorization: `Bearer ${token}`,
        ...(options.headers ?? {}),
      },
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      const msg = body?.message ? `${body.message}` : `HTTP ${res.status}`;
      throw new Error(`GitHub API error: ${msg}`);
    }
    return body;
  };

  const publish = async () => {
    const token = tokenInput.value.trim();
    if (!token) {
      log("Paste your GitHub token first.");
      return;
    }

    const repoPath = getRepoPath();
    const repoPathEscaped = repoPath
      .split("/")
      .map((segment) => encodeURIComponent(segment))
      .join("/");
    const msg = commitInput.value.trim() || "Update churomi.com content";
    const html = buildHtml();

    log(`Publishing ${repoPath}...`);

    const existing = await gh(
      `/repos/${OWNER}/${REPO}/contents/${repoPathEscaped}?ref=${encodeURIComponent(BRANCH)}`,
      token,
    );
    const sha = existing?.sha;
    if (!sha) throw new Error("Could not read current file SHA.");

    await gh(`/repos/${OWNER}/${REPO}/contents/${repoPathEscaped}`, token, {
      method: "PUT",
      body: JSON.stringify({
        message: `${msg} (${current.lang}/${current.page})`,
        content: safeBase64(html),
        sha,
        branch: BRANCH,
      }),
    });

    log("Published. GitHub Pages will update shortly.");
  };

  const syncUiToState = () => {
    pageSelect.value = current.page;
    langSelect.value = current.lang;
  };

  const onSelectionChange = async () => {
    current.page = pageSelect.value;
    current.lang = langSelect.value;
    try {
      await load();
    } catch (err) {
      log(String(err?.message ?? err));
    }
  };

  pageSelect.addEventListener("change", onSelectionChange);
  langSelect.addEventListener("change", onSelectionChange);

  reloadBtn.addEventListener("click", async () => {
    try {
      await load();
    } catch (err) {
      log(String(err?.message ?? err));
    }
  });

  downloadBtn.addEventListener("click", download);

  publishBtn.addEventListener("click", async () => {
    publishBtn.disabled = true;
    try {
      await publish();
    } catch (err) {
      log(String(err?.message ?? err));
    } finally {
      publishBtn.disabled = false;
    }
  });

  const init = async () => {
    syncUiToState();
    try {
      await load();
    } catch (err) {
      log(String(err?.message ?? err));
    }
  };

  void init();
})();
