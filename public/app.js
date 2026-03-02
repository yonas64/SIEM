const statusEl = document.getElementById("status");
const alertsEl = document.getElementById("alerts");
const activityEl = document.getElementById("activity");
const logsEl = document.getElementById("logs");
const refreshBtn = document.getElementById("refresh");
const clearLogsBtn = document.getElementById("clearLogs");
const clearAlertsBtn = document.getElementById("clearAlerts");
const form = document.getElementById("logForm");

const isLocalDevPort = ["5173", "3000", "8080"].includes(window.location.port);
const apiOrigin =
  window.location.origin === "null" || isLocalDevPort ? "http://localhost:5000" : window.location.origin;
const API_BASE = `${apiOrigin}/api`;

const setStatus = (text) => {
  statusEl.textContent = text;
};

const addActivity = (text, type = "info") => {
  const item = document.createElement("div");
  item.className = "activity-item";
  item.textContent = `[${new Date().toLocaleTimeString()}] ${text}`;
  if (type === "error") {
    item.style.borderColor = "rgba(169, 28, 47, 0.4)";
    item.style.background = "#ffecef";
  }
  activityEl.prepend(item);
};

const formatDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

const renderAlerts = (alerts) => {
  alertsEl.innerHTML = "";
  if (!alerts.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "No alerts yet.";
    alertsEl.appendChild(empty);
    return;
  }
  alerts.forEach((alert) => {
    const card = document.createElement("div");
    card.className = "alert-card";

    const meta = document.createElement("div");
    meta.className = "alert-meta";
    meta.innerHTML = `
      <span>${formatDate(alert.triggeredAt)}</span>
      <span>${alert.ip ?? "unknown ip"}</span>
    `;

    const title = document.createElement("div");
    title.textContent = alert.message || "Alert triggered";

    const tag = document.createElement("span");
    const severity = (alert.severity || "low").toLowerCase();
    tag.className = `tag ${severity}`;
    tag.textContent = severity;

    const rule = document.createElement("div");
    rule.className = "muted";
    rule.textContent = `Rule: ${alert.ruleId || "unknown"}`;

    card.appendChild(meta);
    card.appendChild(title);
    card.appendChild(tag);
    card.appendChild(rule);
    alertsEl.appendChild(card);
  });
};

const renderLogs = (logs) => {
  logsEl.innerHTML = "";
  if (!logs.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "No logs yet.";
    logsEl.appendChild(empty);
    return;
  }
  logs.forEach((log) => {
    const card = document.createElement("div");
    card.className = "log-card";

    const meta = document.createElement("div");
    meta.className = "log-meta";
    meta.innerHTML = `
      <span>${formatDate(log.timestamp)}</span>
      <span>${log.ip ?? "unknown ip"}</span>
    `;

    const title = document.createElement("div");
    title.textContent = log.event || "Log event";

    const source = document.createElement("div");
    source.className = "muted";
    source.textContent = `Source: ${log.source || "unknown"}`;

    const tag = document.createElement("span");
    const severity = (log.severity || "low").toLowerCase();
    tag.className = `tag ${severity}`;
    tag.textContent = severity;

    card.appendChild(meta);
    card.appendChild(title);
    card.appendChild(tag);
    card.appendChild(source);
    logsEl.appendChild(card);
  });
};

const loadAlerts = async () => {
  setStatus("Loading alerts...");
  try {
    const res = await fetch(`${API_BASE}/alerts`);
    if (!res.ok) throw new Error(`Alert fetch failed (${res.status})`);
    const data = await res.json();
    renderAlerts(data);
    addActivity(`Loaded ${data.length} alerts`);
  } catch (err) {
    addActivity(err.message, "error");
  } finally {
    setStatus("Idle");
  }
};

const loadLogs = async () => {
  setStatus("Loading logs...");
  try {
    const res = await fetch(`${API_BASE}/logs`);
    if (!res.ok) throw new Error(`Log fetch failed (${res.status})`);
    const data = await res.json();
    renderLogs(data);
    addActivity(`Loaded ${data.length} logs`);
  } catch (err) {
    addActivity(err.message, "error");
  } finally {
    setStatus("Idle");
  }
};

const clearLogs = async () => {
  const shouldClear = window.confirm("Clear all logs from the database?");
  if (!shouldClear) return;

  setStatus("Clearing logs...");
  try {
    const res = await fetch(`${API_BASE}/logs`, { method: "DELETE" });
    if (!res.ok) throw new Error(`Clear logs failed (${res.status})`);
    const data = await res.json();
    addActivity(`Cleared ${data.deletedCount ?? 0} logs`);
    await loadLogs();
  } catch (err) {
    addActivity(err.message, "error");
  } finally {
    setStatus("Idle");
  }
};

const clearAlerts = async () => {
  const shouldClear = window.confirm("Clear all alerts from the database?");
  if (!shouldClear) return;

  setStatus("Clearing alerts...");
  try {
    const res = await fetch(`${API_BASE}/alerts`, { method: "DELETE" });
    if (!res.ok) throw new Error(`Clear alerts failed (${res.status})`);
    const data = await res.json();
    addActivity(`Cleared ${data.deletedCount ?? 0} alerts`);
    await loadAlerts();
  } catch (err) {
    addActivity(err.message, "error");
  } finally {
    setStatus("Idle");
  }
};

const buildPayload = (formData) => {
  const payload = {};
  for (const [key, value] of formData.entries()) {
    if (!value) continue;
    if (key === "raw") continue;
    payload[key] = value;
  }
  const raw = formData.get("raw");
  if (raw) {
    try {
      payload.raw = JSON.parse(raw);
    } catch {
      payload.raw = { raw };
    }
  }
  return payload;
};

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus("Sending log...");
  const formData = new FormData(form);
  const payload = buildPayload(formData);

  try {
    const res = await fetch(`${API_BASE}/logs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Log send failed (${res.status})`);
    const data = await res.json();
    addActivity(`Log stored (${data._id || "ok"})`);
    setStatus("Idle");
    await loadAlerts();
    await loadLogs();
  } catch (err) {
    addActivity(err.message, "error");
    setStatus("Error");
  }
});

refreshBtn.addEventListener("click", async () => {
  await loadAlerts();
  await loadLogs();
});

clearLogsBtn.addEventListener("click", clearLogs);
clearAlertsBtn.addEventListener("click", clearAlerts);

loadAlerts();
loadLogs();
