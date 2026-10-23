import { addDays, todayIso } from "@/lib/format";

export type AnalyticsRow = {
  date: string;
  signups: number;
  placementsStarted: number;
  placementsCompleted: number;
  plansStarted: number;
  exercises: number;
  returned: number;
  proIntent: number;
};

function hash(seed: number) {
  let value = seed;
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
}

export function sampleAnalytics(days = 42, end = todayIso()): AnalyticsRow[] {
  const random = hash(20261023);
  return Array.from({ length: days }, (_, index) => {
    const date = addDays(end, index - (days - 1));
    const wave = 0.75 + (index % 7 === 5 ? 0.35 : 0);
    const signups = Math.round((18 + random() * 10) * wave);
    const placementsStarted = Math.round(signups * (0.62 + random() * 0.08));
    const placementsCompleted = Math.round(placementsStarted * (0.71 + random() * 0.06));
    const plansStarted = Math.round(placementsCompleted * (0.64 + random() * 0.08));
    return {
      date,
      signups,
      placementsStarted,
      placementsCompleted,
      plansStarted,
      exercises: Math.round(plansStarted * (1.4 + random())),
      returned: Math.round(signups * (0.28 + random() * 0.08)),
      proIntent: Math.round(plansStarted * (0.06 + random() * 0.04)),
    };
  });
}

export function sumRows(rows: AnalyticsRow[]) {
  return rows.reduce(
    (total, row) => ({
      signups: total.signups + row.signups,
      placementsStarted: total.placementsStarted + row.placementsStarted,
      placementsCompleted: total.placementsCompleted + row.placementsCompleted,
      plansStarted: total.plansStarted + row.plansStarted,
      exercises: total.exercises + row.exercises,
      returned: total.returned + row.returned,
      proIntent: total.proIntent + row.proIntent,
    }),
    { signups: 0, placementsStarted: 0, placementsCompleted: 0, plansStarted: 0, exercises: 0, returned: 0, proIntent: 0 },
  );
}
