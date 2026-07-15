import type { Dispatch } from "react";
import type { DemoAction, DemoState } from "../engine";
import type { Effect, IndustryConfig } from "../types";

/** Props every demo tab view receives from DemoOS. */
export type ViewProps = {
  state: DemoState;
  config: IndustryConfig;
  dispatch: Dispatch<DemoAction>;
  /** Record that the visitor touched a feature (for the CTA context summary). */
  track: (key: string) => void;
};

export function applyNow(dispatch: Dispatch<DemoAction>, effects: Effect[]): void {
  dispatch({ type: "effects", effects });
}

export const TIME_OPTIONS = [
  "8:00 AM", "9:00 AM", "10:00 AM", "11:00 AM", "12:00 PM",
  "1:00 PM", "2:00 PM", "3:00 PM", "4:00 PM", "5:00 PM", "6:00 PM",
];
