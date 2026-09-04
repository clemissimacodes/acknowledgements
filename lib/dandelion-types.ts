export const WIND_MISS =
  "the wind did not take your wish /: seems like ur dreams are out of reach my friend";

export type Wish = {
  id: string;
  body: string;
  createdAt: string;
  location?: string;
  gender?: string;
  age?: string;
};

export type WishExtras = {
  location?: string;
  gender?: string;
  age?: string;
};
