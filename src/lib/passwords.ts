import bcrypt from "bcryptjs";

// Tests run the real bcrypt but at the minimum cost, so the suite stays fast.
const IS_TEST = process.env.NODE_ENV === "test";
const COST = IS_TEST ? 4 : 12;

// A real cost-12 bcrypt hash of a random throwaway string (keep its cost equal to COST above). When
// someone signs in with an email that has no account, we still do a full bcrypt comparison against this,
// so the response takes as long as a real attempt and timing can't be used to find out which emails are
// registered. In tests it's a cheap hash instead, matching the cheap cost real test hashes use.
const DUMMY_HASH = IS_TEST ? bcrypt.hashSync("dummy-password-for-timing", COST) : "$2a$12$Uxrwco2msC7jMmN1Jwsox.WLmm4D5sXMMi0XHDoxmCFgwdKh7c8ay";

export const hashPassword = (password: string): Promise<string> => bcrypt.hash(password, COST);

export async function verifyPassword(password: string, hash: string | null | undefined): Promise<boolean> {
  if (!hash) {
    await bcrypt.compare(password, DUMMY_HASH);
    return false;
  }
  return bcrypt.compare(password, hash);
}
