import assert from "node:assert/strict";
import test from "node:test";
import { decideFollowUp } from "../src/matter_decision.js";

test("a filing due within 72 hours enters the follow-up queue", () => {
  const now = new Date("2026-09-13T09:00:00+08:00");
  assert.equal(decideFollowUp("2026-09-15T09:00:00+08:00", now), "due_soon");
});

test("a passed filing deadline is marked overdue", () => {
  const now = new Date("2026-09-13T09:00:00+08:00");
  assert.equal(decideFollowUp("2026-09-12T18:00:00+08:00", now), "overdue");
});
