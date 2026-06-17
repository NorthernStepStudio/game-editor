import type { NssModeId } from "../models/mode.types.js";

export const NSS_MODES: ReadonlyArray<{ id: NssModeId; title: string }> = [
  { id: "coding", title: "Coding" },
  { id: "debugging", title: "Debugging" },
  { id: "product", title: "Product" },
  { id: "marketing", title: "Marketing" },
  { id: "research", title: "Research" },
  { id: "architect", title: "Architect" },
];
