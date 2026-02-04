export { api } from "../../convex/_generated/api";
export type { Id, Doc } from "../../convex/_generated/dataModel";
export type EvidenceLocator = {
  page: number;
  text: string;
  boxes: Array<{ x: number; y: number; width: number; height: number }>;
};
