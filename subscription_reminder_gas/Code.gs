const PROP = PropertiesService.getScriptProperties();

const CONFIG = Object.freeze({
  DEFAULT_SHEET_NAME: "Subscriptions",
  DEFAULT_REMINDER_DAYS: "7,3,1",
  DEFAULT_PAYMENT_METHOD_OPTIONS: "クレジットカード,デビットカード,Apple IDまとめて支払い,Google Play課金,キャリア決済,PayPay,楽天ペイ,PayPal,口座振替,その他",
  PUSH_URL: "https://api.line.me/v2/bot/message/push",
  REPLY_URL: "https://api.line.me/v2/bot/message/reply",
  HEADER: [
    "ID",
    "サービス名",
    "期限日",
    "金額",
    "決済方法",
    "停止(シート)",
    "通知日(カンマ区切り)",
    "LINEユーザーID",
    "停止(LINE)",
    "通知履歴キー",
    "メモ"
  ],
  COL: Object.freeze({
    ID: 1,
    SERVICE_NAME: 2,
    DUE_DATE: 3,
    AMOUNT: 4,
    PAYMENT_METHOD: 5,
    STOP_BY_SHEET: 6,
    REMINDER_DAYS: 7,
    LINE_USER_ID: 8,
    STOP_BY_LINE: 9,
    SENT_HISTORY: 10,
    NOTE: 11
  })
});

function doPost(e) {
  const body = parseWebhookBody_(e);
  const events = body.events || [];

  events.forEach(function(event) {
    try {
      handleWebhookEvent_(event);
    } catch (err) {
      console.error("Webhook event error:", err);
    }
  });

  return ContentService.createTextOutput("ok");
}

function checkSubscriptions() {
  const cfg = getRuntimeConfig_();
  if (!cfg.lineToken) throw new Error("LINE_CHANNEL_ACCESS_TOKEN が未設定です。");

  const sheet = getSheet_(cfg.sheetName);
  ensureHeaderRow_(sheet);

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  const range = sheet.getRange(2, 1, lastRow - 1, CONFIG.HEADER.length);
  const rows = range.getValues();
  const idsTouched = fillMissingIds_(rows);
  let changed = idsTouched;
  const errors = [];

  const today = startOfDay_(new Date());
  const fallbackUserId = cfg.targetUserId;
  const defaultReminderDays = parseReminderDays_(cfg.defaultReminderDays);

  rows.forEach(function(row, idx) {
    const serviceName = safeText_(row[CONFIG.COL.SERVICE_NAME - 1]);
    const dueDate = toValidDate_(row[CONFIG.COL.DUE_DATE - 1]);
    if (!serviceName || !dueDate) return;

    if (isChecked_(row[CONFIG.COL.STOP_BY_SHEET - 1])) return;
    if (isChecked_(row[CONFIG.COL.STOP_BY_LINE - 1])) return;

    const userId = safeText_(row[CONFIG.COL.LINE_USER_ID - 1]) || fallbackUserId;
    if (!userId) return;

    const reminderDays = parseReminderDays_(row[CONFIG.COL.REMINDER_DAYS - 1], defaultReminderDays);
    const due = startOfDay_(dueDate);
    const daysLeft = diffDays_(today, due);
    if (daysLeft < 0) return;
    if (reminderDays.indexOf(daysLeft) === -1) return;

    const reminderKey = toYmd_(due) + ":" + daysLeft;
    const history = parseSentHistory_(row[CONFIG.COL.SENT_HISTORY - 1]);
    if (history.has(reminderKey)) return;

    const rowId = normalizeRowId_(row[CONFIG.COL.ID - 1]);
    const text = buildReminderText_(rowId, serviceName, due, daysLeft, row[CONFIG.COL.AMOUNT - 1], row[CONFIG.COL.PAYMENT_METHOD - 1]);

    try {
      pushText_(cfg.lineToken, userId, text, rowId);
      history.add(reminderKey);
      row[CONFIG.COL.SENT_HISTORY - 1] = serializeSentHistory_(history);
      changed = true;
    } catch (err) {
      errors.push("row " + (idx + 2) + ": " + err.message);
    }
  });

  if (changed) range.setValues(rows);
  if (errors.length) console.error("checkSubscriptions errors:\n" + errors.join("\n"));
}

function setupSheet() {
  const cfg = getRuntimeConfig_();
  const sheet = getSheet_(cfg.sheetName);

  ensureHeaderRow_(sheet);
  ensureCheckboxColumns_(sheet);
  ensurePaymentMethodDropdown_(sheet);
  ensureColumnFormats_(sheet);
  ensureRowIds();
  sheet.setFrozenRows(1);
}

function setupAll() {
  validateRequiredProperties_();
  setupSheet();
  setupDailyTrigger();
  return "初期設定が完了しました。次に Web アプリをデプロイして LINE Webhook URL を設定してください。";
}

function sendTestNotification() {
  const cfg = getRuntimeConfig_();
  if (!cfg.lineToken) throw new Error("LINE_CHANNEL_ACCESS_TOKEN が未設定です。");
  if (!cfg.targetUserId) throw new Error("TARGET_USER_ID が未設定です。");

  const text = [
    "【テスト通知】",
    "サブスク通知システムの接続テストです。",
    "このメッセージが届けば LINE 連携は正常です。"
  ].join("\n");
  pushText_(cfg.lineToken, cfg.targetUserId, text, "");
}

function ensureRowIds() {
  const cfg = getRuntimeConfig_();
  const sheet = getSheet_(cfg.sheetName);
  ensureHeaderRow_(sheet);

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  const range = sheet.getRange(2, 1, lastRow - 1, CONFIG.HEADER.length);
  const rows = range.getValues();
  const changed = fillMissingIds_(rows);
  if (changed) range.setValues(rows);
}

function setupDailyTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(function(t) { return t.getHandlerFunction() === "checkSubscriptions"; })
    .forEach(function(t) { ScriptApp.deleteTrigger(t); });

  const hour = normalizeHour_(PROP.getProperty("DAILY_TRIGGER_HOUR"));
  ScriptApp.newTrigger("checkSubscriptions").timeBased().everyDays(1).atHour(hour).create();
}

function handleWebhookEvent_(event) {
  const userId = getUserIdFromEvent_(event);
  if (userId) PROP.setProperty("TARGET_USER_ID", userId);

  if (!event) return;
  if (event.type === "follow") {
    if (event.replyToken) {
      replyText_(event.replyToken, "通知先を登録しました。\n" + lineHelpText_());
    }
    return;
  }

  if (event.type !== "message" || !event.message || event.message.type !== "text") return;
  if (!event.replyToken) return;

  const text = safeText_(event.message.text);
  let reply = "";
  try {
    reply = handleLineCommand_(text, userId);
  } catch (err) {
    reply = "操作エラー: " + (err && err.message ? err.message : "不明なエラー");
  }
  replyText_(event.replyToken, reply);
}

function handleLineCommand_(rawText, userId) {
  if (!userId) return "1:1トークで実行してください。";

  const text = normalizeLineInput_(rawText);
  if (!text) return lineHelpText_();

  if (/^(HELP|ヘルプ|使い方)$/i.test(text)) return lineHelpText_();
  if (/^(一覧|LIST)$/i.test(text)) return listSubscriptionsForUser_(userId);
  if (/^(支払い一覧|決済一覧|PAYMENT)$/i.test(text)) return listPaymentMethodsForUser_(userId);

  let m = text.match(/^停止\s+(.+)$/i);
  if (m) return stopOrResumeFromLine_(m[1], true, userId);

  m = text.match(/^再開\s+(.+)$/i);
  if (m) return stopOrResumeFromLine_(m[1], false, userId);

  if (/^(停止|再開)$/.test(text)) {
    return "IDを指定してください。\n例: 停止 SUB-AB12CD34\n" + lineHelpText_();
  }

  return lineHelpText_();
}

function stopOrResumeFromLine_(target, shouldStop, userId) {
  const value = normalizeLineInput_(target).toUpperCase();
  if (/^(ALL|全部)$/.test(value)) {
    return updateLineStopAll_(shouldStop, userId);
  }
  return updateLineStopById_(value, shouldStop, userId);
}

function updateLineStopById_(rowId, shouldStop, userId) {
  const cfg = getRuntimeConfig_();
  const sheet = getSheet_(cfg.sheetName);
  ensureHeaderRow_(sheet);

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return "データがありません。";

  const range = sheet.getRange(2, 1, lastRow - 1, CONFIG.HEADER.length);
  const rows = range.getValues();
  let changed = fillMissingIds_(rows);
  let found = false;

  rows.forEach(function(row) {
    const currentId = normalizeRowId_(row[CONFIG.COL.ID - 1]);
    if (currentId !== rowId) return;
    found = true;

    const rowUserId = safeText_(row[CONFIG.COL.LINE_USER_ID - 1]);
    if (rowUserId && rowUserId !== userId) throw new Error("このIDは操作できません。");

    row[CONFIG.COL.STOP_BY_LINE - 1] = shouldStop;
    if (!rowUserId) row[CONFIG.COL.LINE_USER_ID - 1] = userId;
    changed = true;
  });

  if (!found) return "ID " + rowId + " が見つかりませんでした。";
  if (changed) range.setValues(rows);

  return shouldStop
    ? "停止しました: " + rowId + "\n再開するには「再開 " + rowId + "」"
    : "再開しました: " + rowId;
}

function updateLineStopAll_(shouldStop, userId) {
  const cfg = getRuntimeConfig_();
  const sheet = getSheet_(cfg.sheetName);
  ensureHeaderRow_(sheet);

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return "データがありません。";

  const range = sheet.getRange(2, 1, lastRow - 1, CONFIG.HEADER.length);
  const rows = range.getValues();
  let changed = fillMissingIds_(rows);
  let affected = 0;

  rows.forEach(function(row) {
    const serviceName = safeText_(row[CONFIG.COL.SERVICE_NAME - 1]);
    const dueDate = toValidDate_(row[CONFIG.COL.DUE_DATE - 1]);
    if (!serviceName || !dueDate) return;

    const rowUserId = safeText_(row[CONFIG.COL.LINE_USER_ID - 1]);
    if (rowUserId && rowUserId !== userId) return;

    if (Boolean(row[CONFIG.COL.STOP_BY_LINE - 1]) === shouldStop) return;
    row[CONFIG.COL.STOP_BY_LINE - 1] = shouldStop;
    if (!rowUserId) row[CONFIG.COL.LINE_USER_ID - 1] = userId;
    changed = true;
    affected++;
  });

  if (changed) range.setValues(rows);
  return (shouldStop ? "LINE停止を一括設定しました: " : "LINE停止を一括解除しました: ") + affected + "件";
}

function listSubscriptionsForUser_(userId) {
  const cfg = getRuntimeConfig_();
  const sheet = getSheet_(cfg.sheetName);
  ensureHeaderRow_(sheet);

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return "データがありません。";

  const range = sheet.getRange(2, 1, lastRow - 1, CONFIG.HEADER.length);
  const rows = range.getValues();
  const changed = fillMissingIds_(rows);
  if (changed) range.setValues(rows);

  const lines = ["サブスク一覧"];
  let count = 0;

  rows.forEach(function(row) {
    const serviceName = safeText_(row[CONFIG.COL.SERVICE_NAME - 1]);
    const dueDate = toValidDate_(row[CONFIG.COL.DUE_DATE - 1]);
    if (!serviceName || !dueDate) return;

    const rowUserId = safeText_(row[CONFIG.COL.LINE_USER_ID - 1]);
    if (rowUserId && rowUserId !== userId) return;

    const id = normalizeRowId_(row[CONFIG.COL.ID - 1]);
    const paymentMethod = safeText_(row[CONFIG.COL.PAYMENT_METHOD - 1]) || "未設定";
    const status = buildStatusLabel_(row[CONFIG.COL.STOP_BY_SHEET - 1], row[CONFIG.COL.STOP_BY_LINE - 1]);
    lines.push(id + " | " + serviceName + " | " + paymentMethod + " | " + toYmd_(dueDate) + " | " + status);
    count++;
  });

  if (!count) {
    return "操作可能なデータがありません。";
  }

  lines.push("");
  lines.push("停止: 停止 <ID>");
  lines.push("再開: 再開 <ID>");
  lines.push("決済内訳: 支払い一覧");
  lines.push("一括停止: 停止 全部");
  lines.push("一括再開: 再開 全部");
  return lines.join("\n");
}

function listPaymentMethodsForUser_(userId) {
  const cfg = getRuntimeConfig_();
  const sheet = getSheet_(cfg.sheetName);
  ensureHeaderRow_(sheet);

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return "データがありません。";

  const range = sheet.getRange(2, 1, lastRow - 1, CONFIG.HEADER.length);
  const rows = range.getValues();
  const changed = fillMissingIds_(rows);
  if (changed) range.setValues(rows);

  const byMethod = {};

  rows.forEach(function(row) {
    const serviceName = safeText_(row[CONFIG.COL.SERVICE_NAME - 1]);
    const dueDate = toValidDate_(row[CONFIG.COL.DUE_DATE - 1]);
    if (!serviceName || !dueDate) return;

    const rowUserId = safeText_(row[CONFIG.COL.LINE_USER_ID - 1]);
    if (rowUserId && rowUserId !== userId) return;

    const method = safeText_(row[CONFIG.COL.PAYMENT_METHOD - 1]) || "未設定";
    if (!byMethod[method]) byMethod[method] = [];
    byMethod[method].push(serviceName);
  });

  const methods = Object.keys(byMethod).sort();
  if (!methods.length) return "操作可能なデータがありません。";

  const lines = ["支払い方法一覧"];
  methods.forEach(function(method) {
    const services = byMethod[method];
    const preview = services.slice(0, 3).join(" / ");
    const tail = services.length > 3 ? " ...他" + (services.length - 3) + "件" : "";
    lines.push(method + ": " + preview + tail);
  });
  lines.push("");
  lines.push("詳細は「一覧」で確認できます。");
  return lines.join("\n");
}

function lineHelpText_() {
  return [
    "利用可能コマンド",
    "・一覧",
    "・支払い一覧",
    "・停止 <ID>",
    "・再開 <ID>",
    "・停止 全部",
    "・再開 全部",
    "例: 停止 SUB-AB12CD34"
  ].join("\n");
}

function pushText_(token, userId, text, rowId) {
  const message = { type: "text", text: text };
  if (rowId) {
    message.quickReply = {
      items: [
        {
          type: "action",
          action: { type: "message", label: "停止する", text: "停止 " + rowId }
        },
        {
          type: "action",
          action: { type: "message", label: "再開する", text: "再開 " + rowId }
        },
        {
          type: "action",
          action: { type: "message", label: "一覧", text: "一覧" }
        }
      ]
    };
  }

  callLineApi_(CONFIG.PUSH_URL, token, {
    to: userId,
    messages: [message]
  });
}

function replyText_(replyToken, text) {
  const token = PROP.getProperty("LINE_CHANNEL_ACCESS_TOKEN");
  if (!token) return;
  callLineApi_(CONFIG.REPLY_URL, token, {
    replyToken: replyToken,
    messages: [{ type: "text", text: text }]
  });
}

function callLineApi_(url, token, payload) {
  const res = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: "Bearer " + token },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  if (res.getResponseCode() >= 300) {
    throw new Error("LINE API error " + res.getResponseCode() + ": " + res.getContentText());
  }
}

function getRuntimeConfig_() {
  return {
    sheetName: PROP.getProperty("SHEET_NAME") || CONFIG.DEFAULT_SHEET_NAME,
    defaultReminderDays: PROP.getProperty("REMINDER_DAYS_DEFAULT") || CONFIG.DEFAULT_REMINDER_DAYS,
    targetUserId: safeText_(PROP.getProperty("TARGET_USER_ID")),
    lineToken: PROP.getProperty("LINE_CHANNEL_ACCESS_TOKEN")
  };
}

function getSheet_(sheetName) {
  const ss = getSpreadsheet_();
  return ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);
}

function getSpreadsheet_() {
  const id = PROP.getProperty("SPREADSHEET_ID");
  if (id) return SpreadsheetApp.openById(id);
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (!active) throw new Error("SPREADSHEET_ID が未設定です。");
  return active;
}

function ensureHeaderRow_(sheet) {
  const current = sheet.getRange(1, 1, 1, CONFIG.HEADER.length).getValues()[0];
  const needsHeader = CONFIG.HEADER.some(function(head, idx) {
    return String(current[idx] || "") !== head;
  });
  if (needsHeader) sheet.getRange(1, 1, 1, CONFIG.HEADER.length).setValues([CONFIG.HEADER]);
  sheet.setFrozenRows(1);
}

function ensureCheckboxColumns_(sheet) {
  const maxRows = Math.max(sheet.getMaxRows(), 2);
  const rule = SpreadsheetApp.newDataValidation().requireCheckbox().build();
  sheet.getRange(2, CONFIG.COL.STOP_BY_SHEET, maxRows - 1, 1).setDataValidation(rule);
  sheet.getRange(2, CONFIG.COL.STOP_BY_LINE, maxRows - 1, 1).setDataValidation(rule);
}

function ensurePaymentMethodDropdown_(sheet) {
  const maxRows = Math.max(sheet.getMaxRows(), 2);
  const options = getPaymentMethodOptions_();
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(options, true)
    .setAllowInvalid(true)
    .build();
  sheet.getRange(2, CONFIG.COL.PAYMENT_METHOD, maxRows - 1, 1).setDataValidation(rule);
}

function ensureColumnFormats_(sheet) {
  const maxRows = Math.max(sheet.getMaxRows(), 2);
  sheet.getRange(2, CONFIG.COL.ID, maxRows - 1, 1).setNumberFormat("@");
  sheet.getRange(2, CONFIG.COL.DUE_DATE, maxRows - 1, 1).setNumberFormat("yyyy-mm-dd");
}

function fillMissingIds_(rows) {
  const used = new Set();
  let changed = false;

  rows.forEach(function(row) {
    const id = normalizeRowId_(row[CONFIG.COL.ID - 1]);
    if (!id) return;
    row[CONFIG.COL.ID - 1] = id;
    used.add(id);
  });

  rows.forEach(function(row) {
    const hasData = safeText_(row[CONFIG.COL.SERVICE_NAME - 1]) || toValidDate_(row[CONFIG.COL.DUE_DATE - 1]);
    if (!hasData) return;
    if (normalizeRowId_(row[CONFIG.COL.ID - 1])) return;

    let id = makeRowId_();
    while (used.has(id)) id = makeRowId_();
    row[CONFIG.COL.ID - 1] = id;
    used.add(id);
    changed = true;
  });

  return changed;
}

function buildReminderText_(rowId, serviceName, due, daysLeft, amount, paymentMethod) {
  const daysLabel = daysLeft === 0 ? "本日" : "残り " + daysLeft + " 日";
  return [
    "【サブスク期限リマインド】",
    "ID: " + rowId,
    "サービス: " + serviceName,
    "期限日: " + toYmd_(due),
    daysLabel,
    "金額: " + formatAmount_(amount),
    "決済方法: " + (safeText_(paymentMethod) || "-"),
    "",
    "停止する場合: 停止 " + rowId
  ].join("\n");
}

function parseReminderDays_(value, fallback) {
  const base = safeText_(value);
  const source = base || (fallback ? fallback.join(",") : CONFIG.DEFAULT_REMINDER_DAYS);

  const parsed = source.split(",")
    .map(function(s) { return Number(s.trim()); })
    .filter(function(n) { return Number.isInteger(n) && n >= 0 && n <= 365; });

  const uniq = Array.from(new Set(parsed));
  if (uniq.length) return uniq;
  if (fallback && fallback.length) return fallback;
  return [7, 3, 1];
}

function parseSentHistory_(value) {
  const set = new Set();
  safeText_(value).split(",").forEach(function(part) {
    const key = safeText_(part);
    if (key) set.add(key);
  });
  return set;
}

function serializeSentHistory_(set) {
  return Array.from(set).sort().slice(-50).join(",");
}

function formatAmount_(value) {
  if (value === null || value === "") return "-";
  if (typeof value === "number") return value.toLocaleString("ja-JP");
  const num = Number(value);
  if (Number.isFinite(num) && String(value).trim() !== "") return num.toLocaleString("ja-JP");
  return String(value);
}

function buildStatusLabel_(sheetStop, lineStop) {
  if (isChecked_(sheetStop)) return "停止(シート)";
  if (isChecked_(lineStop)) return "停止(LINE)";
  return "有効";
}

function normalizeRowId_(value) {
  const text = safeText_(value).toUpperCase();
  return text || "";
}

function makeRowId_() {
  return "SUB-" + Utilities.getUuid().slice(0, 8).toUpperCase();
}

function normalizeHour_(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > 23) return 9;
  return n;
}

function isChecked_(value) {
  return value === true || String(value).toLowerCase() === "true";
}

function normalizeLineInput_(text) {
  return safeText_(text).replace(/\s+/g, " ");
}

function parseWebhookBody_(e) {
  try {
    return JSON.parse((e && e.postData && e.postData.contents) || "{}");
  } catch (err) {
    console.error("Webhook parse error:", err);
    return {};
  }
}

function getUserIdFromEvent_(event) {
  return event && event.source && event.source.userId ? event.source.userId : "";
}

function getPaymentMethodOptions_() {
  const raw = PROP.getProperty("PAYMENT_METHOD_OPTIONS") || CONFIG.DEFAULT_PAYMENT_METHOD_OPTIONS;
  const uniq = Array.from(new Set(raw.split(",").map(function(v) { return safeText_(v); }).filter(Boolean)));
  return uniq.length ? uniq : ["その他"];
}

function validateRequiredProperties_() {
  const missing = [];
  if (!safeText_(PROP.getProperty("SPREADSHEET_ID"))) missing.push("SPREADSHEET_ID");
  if (!safeText_(PROP.getProperty("LINE_CHANNEL_ACCESS_TOKEN"))) missing.push("LINE_CHANNEL_ACCESS_TOKEN");
  if (missing.length) {
    throw new Error("Script Properties 未設定: " + missing.join(", "));
  }
}

function safeText_(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function toValidDate_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) return value;
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

function startOfDay_(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function diffDays_(fromDate, toDate) {
  return Math.floor((toDate.getTime() - fromDate.getTime()) / 86400000);
}

function toYmd_(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), "yyyy-MM-dd");
}
