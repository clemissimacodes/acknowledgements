export const RELATIONSHIPS = ["friends", "more-than-friends", "acquaintances"] as const;
export type Relationship = (typeof RELATIONSHIPS)[number];

export const RELATIONSHIP_LABELS: Record<Relationship, string> = {
  friends: "Friends",
  "more-than-friends": "More than friends",
  acquaintances: "Acquaintances",
};

export type Note = {
  name: string;
  slug: string;
  hook: string;
  first?: string;
  last?: string;
  company?: string;
  notes?: string;
  date?: string;
  place?: string;
  relationship?: Relationship;
  example: boolean;
  bubbles: string[];
};
