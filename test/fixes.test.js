import { test } from "node:test";
import assert from "node:assert/strict";
import { shouldUseFallback } from "../src/loop.js";
import { buildSystemPrompt, buildTimeNote } from "../src/prompt.js";
import {
  formatPlaces,
  haversineMetres,
  toolErrorResult,
  CT_HUB_2,
} from "../src/tools.js";

// Issue #1: Berseh fallback
test("food questions no longer trigger the Berseh fallback", () => {
  assert.equal(shouldUseFallback({ GOOGLE_PLACES_API_KEY: "key" }), false);
});

test("missing Places key still triggers the Berseh fallback", () => {
  assert.equal(shouldUseFallback({}), true);
});

// Issue #2: Bedok centre
test("formatPlaces measures distance from CT Hub 2, so Bedok is far away", () => {
  const places = [
    {
      displayName: { text: "Bedok 85" },
      rating: 4.2,
      location: { latitude: 1.3326, longitude: 103.9381 },
    },
  ];
  const [bedok] = formatPlaces(places, CT_HUB_2);
  assert.ok(bedok.distance_m > 8000, `got ${bedok.distance_m}`);
});

// Hidden bug 2: system prompt changed every request, defeating caching
test("system prompt is identical across requests", () => {
  assert.equal(buildSystemPrompt(), buildSystemPrompt());
  assert.doesNotMatch(buildSystemPrompt(), /Request [0-9a-f-]{36}/);
});

// Hidden bug 3: time was given in UTC
test("time note gives Singapore time, not UTC", () => {
  // 04:30 UTC is 12:30 pm in Singapore.
  const note = buildTimeNote(new Date("2026-11-11T04:30:00Z"));
  assert.match(note, /12:30/);
  assert.match(note, /pm/i);
  assert.match(note, /SGT/);
});

// Hidden bug 4: CT Hub 2 coordinates were ~210 m west
test("CT_HUB_2 is within 20 m of OneMap's location for 114 Lavender St", () => {
  const oneMap = { latitude: 1.311587913, longitude: 103.863375124 };
  assert.ok(haversineMetres(CT_HUB_2, oneMap) < 20);
});

// Hidden bug 5: opening hours were fetched then dropped
test("formatPlaces passes on whether each place is open now", () => {
  const location = { latitude: 1.3116, longitude: 103.8634 };
  const [open, closed, unknown] = formatPlaces(
    [
      { displayName: { text: "A" }, location, currentOpeningHours: { openNow: true } },
      { displayName: { text: "B" }, location, currentOpeningHours: { openNow: false } },
      { displayName: { text: "C" }, location },
    ],
    CT_HUB_2,
  );
  assert.equal(open.open_now, true);
  assert.equal(closed.open_now, false);
  assert.equal(unknown.open_now, null);
});

// Hidden bug 6: a failing tool crashed the whole turn
test("toolErrorResult reports timeouts separately from other failures", () => {
  const timeout = Object.assign(new Error("slow"), { name: "TimeoutError" });
  assert.match(toolErrorResult("get_bus_arrivals", timeout).error, /timed out/);
  assert.match(
    toolErrorResult("get_rain_forecast", new TypeError("fetch failed")).error,
    /failed/,
  );
});
