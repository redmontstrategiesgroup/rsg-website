import { Reveal } from "@/components/Reveal";
import type { ManagedServicePlan } from "@/lib/managed-services/types";
import { PlanCard } from "./PlanCard";

/**
 * Responsive grid of managed-service plan cards.
 * The recommended plan is visually highlighted.
 */
export function PlanGrid({ plans }: { plans: ManagedServicePlan[] }) {
  return (
    <div className="grid items-stretch gap-4 md:grid-cols-2 xl:grid-cols-4">
      {plans.map((plan, i) => (
        <Reveal key={plan.id} y={14} delay={(i % 4) * 0.05} className="h-full">
          <PlanCard plan={plan} highlight={plan.recommended} />
        </Reveal>
      ))}
    </div>
  );
}
