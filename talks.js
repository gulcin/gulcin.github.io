/* A dated talk stays upcoming until its end instant.
   start and end are local HH:MM; tz is an IANA zone such as Europe/Madrid.
   With no end time the talk lasts until midnight at the end of date in tz
   (UTC when tz is missing or not a zone). done: true forces the talk into the past. */
(function (g) {
  "use strict";
  const CLOCK = /^([01]\d|2[0-3]):([0-5]\d)$/;

  function clock(value) {
    const m = CLOCK.exec(String(value || ""));
    return m ? { h: +m[1], min: +m[2] } : null;
  }

  function zoneOk(tz) {
    if (!tz || typeof tz !== "string") return false;
    try {
      Intl.DateTimeFormat(undefined, { timeZone: tz });
      return true;
    } catch (e) {
      return false;
    }
  }

  function zoneOf(item) {
    return zoneOk(item && item.tz) ? item.tz : "UTC";
  }

  function partsInZone(instant, tz) {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
    const map = {};
    dtf.formatToParts(instant).forEach(p => { map[p.type] = p.value; });
    return map;
  }

  function offsetMs(instant, tz) {
    const p = partsInZone(instant, tz);
    const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
    return asUTC - instant.getTime();
  }

  function zoned(dateStr, h, min, tz) {
    const [y, mo, d] = dateStr.split("-").map(Number);
    const civil = Date.UTC(y, mo - 1, d, h, min, 0);
    let utc = civil - offsetMs(new Date(civil), tz);
    const again = civil - offsetMs(new Date(utc), tz);
    if (again !== utc) utc = again;
    return new Date(utc);
  }

  function endInstant(item) {
    const date = item && item.date;
    if (!date || String(date).length !== 10) return null;
    const tz = zoneOf(item);
    const hm = clock(item.end);
    if (!hm) return zoned(date, 24, 0, tz);
    return zoned(date, hm.h, hm.min, tz);
  }

  function isUpcoming(item, now) {
    if (!item || item.done) return false;
    const end = endInstant(item);
    if (!end) return false;
    const t = now instanceof Date ? now : new Date();
    return t < end;
  }

  function startMinutes(item) {
    const hm = clock(item.start) || clock(String(item.time || "").split(/[–-]/)[0]);
    return hm ? hm.h * 60 + hm.min : 24 * 60 + 1;
  }

  function compareUpcoming(a, b) {
    const byDate = String(a.date || "").localeCompare(String(b.date || ""));
    return byDate || startMinutes(a) - startMinutes(b);
  }

  function zoneName(item) {
    if (!item || !item.tz) return "";
    if (!zoneOk(item.tz)) return String(item.tz);
    const date = item.date && String(item.date).length === 10 ? item.date : null;
    if (!date) return "";
    const hm = clock(item.start) || { h: 12, min: 0 };
    const instant = zoned(date, hm.h, hm.min, item.tz);
    const name = new Intl.DateTimeFormat("en-GB", {
      timeZone: item.tz,
      timeZoneName: "short"
    }).formatToParts(instant).find(p => p.type === "timeZoneName");
    const label = name ? name.value : "";
    return label === item.tz ? "" : label;
  }

  function whenLabel(item) {
    const range = item && item.time
      ? String(item.time)
      : (clock(item && item.start) && clock(item && item.end)
        ? item.start + "–" + item.end
        : "");
    if (!range) return "";
    const z = zoneName(item);
    return z ? range + " " + z : range;
  }

  const api = { isUpcoming, endInstant, compareUpcoming, zoneName, whenLabel };
  g.talks = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
