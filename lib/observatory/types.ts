/**
 * Observatory domain types, ported from the standalone app (js/scenario.js
 * `newSpec`). A ScenarioSpec is a rich nested object stored as jsonb; these
 * types mirror its shape so the server store and the ported client agree.
 */

/** An intervention delta (close_road, outage, layoff, open_business, ...). The
 *  `type` discriminates; remaining fields are delta-specific (see describeDelta). */
export type ScenarioDelta = { type: string; [key: string]: unknown };

export type ScenarioBranch = { id: string; name: string; deltas: ScenarioDelta[] };

/** Parser warning surfaced in the review step. level: "blocked" | "review". */
export type ScenarioFlag = { level: string; text: string };

export type ScenarioSpec = {
  id: string;
  name: string;
  objective: string;
  worldId: string;
  worldVersion: string;
  horizonDays: number;
  seeds: number;
  headlineMetric: string;
  metrics: string[];
  branches: ScenarioBranch[];
  paramOverrides: Record<string, number>;
  watchOrg: string | null;
  assumptionsNotes: string[];
  flags: ScenarioFlag[];
  reviewed: boolean;
  createdAt: string;
  status: string;
};

/** A scenario as persisted for one tenant. */
export type StoredScenario = {
  id: string; // db row uuid
  specId: string; // the app's own spec.id
  name: string;
  status: string;
  spec: ScenarioSpec;
  createdAt: string;
  updatedAt: string;
};
