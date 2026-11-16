/* Weights are stored in lb; kg is display only. */
export type Units = 'lb' | 'kg';
const KG = 0.45359237;
export const toDisplay = (lb: number | undefined, u: Units) => (lb === undefined ? undefined : u === 'kg' ? Math.round(lb * KG * 10) / 10 : Math.round(lb * 10) / 10);
export const fromDisplay = (v: number | undefined, u: Units) => (v === undefined ? undefined : u === 'kg' ? v / KG : v);
export const fmtWeight = (lb: number | undefined, u: Units) => (lb === undefined ? '—' : `${toDisplay(lb, u)} ${u}`);
export const fmtFtIn = (inches: number) => `${Math.floor(inches / 12)}′${Math.round(inches % 12)}″`;
