// Mock data as frontend fallback.
// Backend can replace this by serving real data to /api/logs
// or by overriding this variable before script.js is loaded.
var logsData = [
  {
    id: "Q001",
    statement: "SELECT id, name, email FROM customers WHERE region = 'US'",
    runTime: "34.5678 ms",
    status: "success",
    timestamp: "2023-10-27 10:30:00"
  },
  {
    id: "Q002",
    statement:
      "INSERT INTO orders (product_id, quantity, user_id) VALUES (12, 1, 345)",
    runTime: "12.3456 ms",
    status: "success",
    timestamp: "2023-10-27 10:29:55"
  },
  {
    id: "Q003",
    statement:
      "UPDATE inventory SET quantity = quantity - 1 WHERE item_id = 101",
    runTime: "87.6543 ms",
    status: "wrong",
    timestamp: "2023-10-27 10:29:50"
  },
  {
    id: "Q004",
    statement:
      "SELECT * FROM logs WHERE type = 'error' AND timestamp > '2023-10-27'",
    runTime: "150.2345 ms",
    status: "warning",
    timestamp: "2023-10-27 10:29:45"
  }
];

// Render table rows from data array
function renderLogs(list) {
  var tbody = document.getElementById("logsBody");
  if (!tbody) return;

  tbody.innerHTML = "";

  list.forEach(function (log) {
    var tr = document.createElement("tr");

    var stateClass = "badge-" + log.status;
    var stateLabel = "";
    if (log.status === "success") {
      stateLabel = "Success";
    } else if (log.status === "warning") {
      stateLabel = "Warning";
    } else if (log.status === "wrong") {
      stateLabel = "Wrong";
    }

    tr.innerHTML =
      "<td>" +
      log.id +
      "</td>" +
      "<td>" +
      log.statement +
      "</td>" +
      '<td><a href="#" class="log-link">' +
      log.runTime +
      "</a></td>" +
      '<td><span class="badge ' +
      stateClass +
      '"><span class="badge-dot"></span>' +
      stateLabel +
      "</span></td>" +
      "<td>" +
      log.timestamp +
      "</td>";

    tbody.appendChild(tr);
  });
}

// Filter logs by search and status
function applyFilters() {
  var searchInput = document.getElementById("searchInput");
  var statusFilter = document.getElementById("statusFilter");
  var tbody = document.getElementById("logsBody");

  if (!searchInput || !statusFilter || !tbody) return;

  var keyword = searchInput.value.toLowerCase();
  var status = statusFilter.value;

  var filtered = logsData.filter(function (log) {
    var matchText = log.statement.toLowerCase().indexOf(keyword) !== -1;
    var matchStatus = status === "all" || log.status === status;
    return matchText && matchStatus;
  });

  renderLogs(filtered);
}

// Backend integration point: load logs from API if data-logs-endpoint is present.
function loadInitialLogs() {
  var container = document.querySelector("[data-logs-endpoint]");
  if (!container) {
    // Not on Log & Performance page
    return;
  }

  var endpoint = container.getAttribute("data-logs-endpoint");
  if (!endpoint) {
    // No backend endpoint configured, just use mock data
    renderLogs(logsData);
    return;
  }

  // Try to fetch from backend; fall back to mock data on error.
  fetch(endpoint)
    .then(function (res) {
      if (!res.ok) {
        throw new Error("Failed to load logs from backend");
      }
      return res.json();
    })
    .then(function (data) {
      // Expected backend JSON structure: array of objects
      // [{ id, statement, runTime, status, timestamp }, ...]
      if (Array.isArray(data) && data.length) {
        logsData = data;
      }
      renderLogs(logsData);
    })
    .catch(function () {
      // Fallback
      renderLogs(logsData);
    });
}

// Export logs: if data-export-endpoint exists, redirect to backend export;
// otherwise generate CSV on the frontend (current behaviour).
function exportLogs() {
  var container = document.querySelector("[data-export-endpoint]");
  var exportEndpoint =
    container && container.getAttribute("data-export-endpoint");

  if (exportEndpoint) {
    // Backend can handle auth / streaming / large dataset
    window.location.href = exportEndpoint;
    return;
  }

  if (!logsData.length) {
    alert("No logs to export.");
    return;
  }

  var header = "Search ID,Inquire statement,Run time,State,Timestamp\n";
  var rows = logsData
    .map(function (log) {
      return (
        log.id +
        ',"' +
        log.statement.replace(/"/g, '""') +
        '",' +
        log.runTime +
        "," +
        log.status +
        "," +
        log.timestamp
      );
    })
    .join("\n");

  var csvContent = header + rows;
  var blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  var url = URL.createObjectURL(blob);

  var a = document.createElement("a");
  a.href = url;
  a.download = "logs.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// 初始化：仅在日志页面存在相关元素时生效
document.addEventListener("DOMContentLoaded", function () {
  var searchInput = document.getElementById("searchInput");
  var statusFilter = document.getElementById("statusFilter");
  var exportButton = document.getElementById("exportButton");
  var tbody = document.getElementById("logsBody");

  // 如果这些元素不存在，说明当前不是日志监控页面，直接返回
  if (!searchInput || !statusFilter || !exportButton || !tbody) {
    return;
  }

  // 1. 从后端加载（如果配置了接口），否则用前端 mock 数据
  loadInitialLogs();

  // 2. 绑定交互事件
  searchInput.addEventListener("input", applyFilters);
  statusFilter.addEventListener("change", applyFilters);
  exportButton.addEventListener("click", exportLogs);
});
