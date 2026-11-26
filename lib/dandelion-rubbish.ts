import { DANDELION_WISH_MIN } from "@/lib/dandelion-types";

/**
 * Spots wishes that are keyboard mashing or filler typed to clear the
 * minimum length: "asdfasdfasdfasdfasdf", "aaaaaaaaaaaaaaaaaaaa",
 * "i wish!!!!!!!!!!!!!!!!", "wish wish wish wish wish".
 *
 * Heuristics only. Each rule is tuned to let real wishes through, including
 * ones written in other alphabets, so a wish has to look fairly clearly
 * like junk before it is swept.
 */
export function isRubbishWish(raw: string): boolean {
  const body = raw.replace(/\s+/g, " ").trim().toLowerCase();
  if (!body) return true;

  // Runs like "aaaaaaa", "!!!!!!!!", "........" shrink to one character.
  // What is left is the real content.
  const collapsed = body.replace(/(.)\1{2,}/gu, "$1");
  const removed = body.length - collapsed.length;

  // Padded to clear the minimum: "i wish!!!!!!!!!!!!!!!!!". Short wishes
  // from before the minimum existed ("joy", "Be healthy") are left alone.
  if (
    removed >= 3 &&
    body.length >= DANDELION_WISH_MIN &&
    collapsed.length < DANDELION_WISH_MIN
  ) {
    return true;
  }

  // Mostly one key held down: "ddddddrrrrrrrrrrrrrrrr", "rrttt".
  if (removed >= 3 && collapsed.length <= body.length * 0.6) return true;

  const compact = collapsed.replace(/ /g, "");
  const chars = [...compact];
  const letters = chars.filter((c) => /\p{L}/u.test(c));

  // Mostly digits and punctuation: "1234567890!!!!!!!!!!". A lone "<3"
  // is a wish of sorts, so this needs a little length.
  if (chars.length >= 6 && letters.length < chars.length / 2) return true;

  // A whole wish made of five or fewer different characters:
  // "hahahahahahahahahaha", "asdfasdfasdfasdfasdf", "wish wish wish wish".
  if (compact.length >= 10 && new Set(chars).size <= 5) return true;

  // Only three different letters across eight or more:
  // "etrtetr454355335treterteer".
  if (letters.length >= 8 && new Set(letters).size <= 3) return true;

  // Same short chunk typed over and over: "qweqweqweqweqweqweqwe".
  if (compact.length >= 9 && /^(.{1,6}?)\1{2,}.{0,3}$/u.test(compact)) {
    return true;
  }

  // The same one or two words repeated to fill the box.
  const words = collapsed.split(" ").filter(Boolean);
  if (words.length >= 4 && new Set(words).size <= 2) return true;

  // Single letters spaced out: "a b c d e f g h i j".
  if (words.length >= 4 && compact.length / words.length < 2) return true;

  // Latin-specific checks. Skipped when most letters are from another
  // script so a wish in Chinese or Arabic is never judged by Latin vowels.
  const latin = letters.filter((c) => /[a-z]/.test(c));
  if (latin.length < letters.length * 0.8) return false;

  // Seven or more consonants in a row inside one word never happens in a
  // real word (German manages six: "dampfschiff"). Spaces break the run
  // so "pls pls pls" is fine.
  if (/[bcdfghjklmnpqrstvwxz]{7,}/.test(collapsed)) return true;

  // Real text is roughly a third vowels. Mashing is mostly consonants.
  const vowels = latin.filter((c) => /[aeiouy]/.test(c)).length;
  if (latin.length >= 10 && vowels / latin.length < 0.15) return true;

  // Mashing with the odd vowel thrown in ("wejkrhwkejrhwkjerh") still
  // spends most of its letters inside four-plus consonant clusters, which
  // real words almost never do.
  const clustered = (collapsed.match(/[bcdfghjklmnpqrstvwxz]{4,}/g) ?? [])
    .join("").length;
  if (latin.length >= 12 && clustered / latin.length >= 0.5) return true;

  // A hand resting on the home row: "asjdhaskjdhaksjdh". English runs
  // about a third home-row letters; mashing is nearly all of them.
  const homeRow = latin.filter((c) => /[asdfghjkl]/.test(c)).length;
  if (latin.length >= 12 && homeRow / latin.length >= 0.9) return true;

  return false;
}
