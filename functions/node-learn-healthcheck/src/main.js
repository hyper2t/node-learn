"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/entry-healthcheck.ts
var entry_healthcheck_exports = {};
__export(entry_healthcheck_exports, {
  default: () => entry_healthcheck_default
});
module.exports = __toCommonJS(entry_healthcheck_exports);

// src/log.ts
var LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
var threshold = LEVELS.info;
function setLogLevel(level) {
  threshold = LEVELS[level];
}
function log(level, message, meta) {
  if (LEVELS[level] < threshold) return;
  const text = JSON.stringify({ ts: (/* @__PURE__ */ new Date()).toISOString(), level, message, ...meta });
  if (level === "error") console.error(text);
  else if (level === "warn") console.warn(text);
  else console.log(text);
}

// src/services/healthcheck.ts
var DEFAULT_TIMEOUT_MS = 7e3;
var MAX_BODY_SAMPLE = 1e3;
var MANUAL_SECRET = "__SET_IN_APPWRITE_CONSOLE__";
function envInt(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 1e3 && n <= 3e4 ? Math.round(n) : fallback;
}
function sampleBody(body) {
  return body.replace(/\s+/g, " ").trim().slice(0, MAX_BODY_SAMPLE);
}
function bodyOk(body) {
  try {
    const json = JSON.parse(body);
    return json.data?.ok === true || json.ok === true;
  } catch {
    return null;
  }
}
async function fetchWithTimeout(url, timeoutMs, init) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
async function postAlert(env, result, timeoutMs) {
  const webhookUrl = env.ALERT_WEBHOOK_URL?.trim();
  if (webhookUrl === MANUAL_SECRET) return { alerted: false, alertError: null };
  if (!webhookUrl) return { alerted: false, alertError: null };
  const text = `${result.name} healthcheck failed: ${result.error ?? `status=${result.statusCode} bodyOk=${result.bodyOk}`}`;
  try {
    const res = await fetchWithTimeout(webhookUrl, Math.min(timeoutMs, DEFAULT_TIMEOUT_MS), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text, source: "node-learn-healthcheck", ...result })
    });
    if (!res.ok) return { alerted: false, alertError: `webhook_status_${res.status}` };
    return { alerted: true, alertError: null };
  } catch (err) {
    return { alerted: false, alertError: err instanceof Error ? err.message : String(err) };
  }
}
async function runHealthcheck(env = process.env) {
  const checkedAt = (/* @__PURE__ */ new Date()).toISOString();
  const name = env.HEALTHCHECK_NAME?.trim() || "Node Learn API";
  const url = env.HEALTHCHECK_URL?.trim() || "";
  const timeoutMs = envInt(env.HEALTHCHECK_TIMEOUT_MS, DEFAULT_TIMEOUT_MS);
  const started = Date.now();
  let base;
  if (!url) {
    base = { ok: false, checkedAt, name, url, durationMs: 0, statusCode: null, bodyOk: null, error: "missing_HEALTHCHECK_URL" };
  } else {
    try {
      const res = await fetchWithTimeout(url, timeoutMs, { headers: { accept: "application/json" } });
      const body = await res.text();
      const parsedBodyOk = bodyOk(body);
      const ok = res.status === 200 && parsedBodyOk === true;
      base = { ok, checkedAt, name, url, durationMs: Date.now() - started, statusCode: res.status, bodyOk: parsedBodyOk, error: ok ? null : sampleBody(body) || "unhealthy_response" };
    } catch (err) {
      base = { ok: false, checkedAt, name, url, durationMs: Date.now() - started, statusCode: null, bodyOk: null, error: err instanceof Error ? err.message : String(err) };
    }
  }
  const alert = base.ok ? { alerted: false, alertError: null } : await postAlert(env, base, timeoutMs);
  const result = { ...base, ...alert };
  log(result.ok ? "info" : "error", result.ok ? "healthcheck_ok" : "healthcheck_failed", { statusCode: result.statusCode, durationMs: result.durationMs, alerted: result.alerted, alertError: result.alertError });
  return result;
}

// src/entry-healthcheck.ts
var jsonHeaders = { "content-type": "application/json; charset=utf-8" };
var entry_healthcheck_default = async ({ res }) => {
  try {
    const level = process.env.LOG_LEVEL;
    if (level === "debug" || level === "info" || level === "warn" || level === "error") setLogLevel(level);
    const result = await runHealthcheck();
    return res.send(JSON.stringify({ ok: result.ok, result }), result.ok ? 200 : 503, jsonHeaders);
  } catch (err) {
    log("error", "healthcheck_function_failure", { message: err instanceof Error ? err.message : String(err) });
    return res.send(JSON.stringify({ ok: false, error: "healthcheck_failed" }), 500, jsonHeaders);
  }
};
