import { getServerSession } from "next-auth";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE as deleteAccountRoute } from "@/app/api/account/route";
import { POST as changePasswordRoute } from "@/app/api/account/password/route";
import { DELETE as signOutEverywhereRoute } from "@/app/api/account/sessions/route";
import { sendEmail } from "@/lib/email";
import { hashPassword, verifyPassword } from "@/lib/passwords";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import type { FakePrisma } from "../fake-prisma";
import { jsonRequest, sentEmails } from "../helpers/routes";

vi.mock("@/lib/prisma", async () => {
  const { createFakePrisma } = await import("../fake-prisma");
  return { prisma: createFakePrisma() };
});
vi.mock("@/lib/email", () => ({ sendEmail: vi.fn() }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/stripe", () => ({ getStripe: vi.fn() }));

const db = prisma as unknown as FakePrisma;
const PASSWORD = "old correct horse battery";
const NEW_PASSWORD = "a brand new passphrase 7";

const signedInAs = (id: string) => vi.mocked(getServerSession).mockResolvedValue({ user: { id } } as never);
const changePassword = (body: unknown) => changePasswordRoute(jsonRequest("http://localhost/api/account/password", body));
const deleteAccount = (body: unknown) => deleteAccountRoute(jsonRequest("http://localhost/api/account", body, { method: "DELETE" }));

async function makeUser(overrides: Record<string, unknown> = {}) {
  const user = await db.user.create({ data: { email: "alice@example.com", name: "Alice", emailVerified: new Date(), passwordHash: await hashPassword(PASSWORD), ...overrides } });
  signedInAs(user.id);
  return user;
}

beforeEach(() => {
  db.__reset();
  vi.mocked(sendEmail).mockResolvedValue({ delivered: true, via: "console" });
  vi.mocked(getServerSession).mockResolvedValue(null as never);
});
afterEach(() => vi.unstubAllEnvs());

describe("change password", () => {
  it("requires being signed in", async () => {
    expect((await changePassword({ currentPassword: PASSWORD, newPassword: NEW_PASSWORD })).status).toBe(401);
  });

  it("changes the password, signs out every session, and notifies the owner", async () => {
    await makeUser();
    const before = Date.now();
    const res = await changePassword({ currentPassword: PASSWORD, newPassword: NEW_PASSWORD });
    expect(res.status).toBe(200);

    const [user] = db.user.__rows;
    expect(await verifyPassword(NEW_PASSWORD, user.passwordHash)).toBe(true);
    expect(user.sessionsValidAfter.getTime()).toBeGreaterThanOrEqual(before - 1000);
    expect(sentEmails().map((m) => m.subject)).toEqual(["Your GenifySuite password was changed"]);
  });

  it("rejects a wrong current password and changes nothing", async () => {
    await makeUser();
    const res = await changePassword({ currentPassword: "not my password", newPassword: NEW_PASSWORD });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/current password is incorrect/);
    expect(await verifyPassword(PASSWORD, db.user.__rows[0].passwordHash)).toBe(true);
    expect(db.user.__rows[0].sessionsValidAfter).toBeNull();
  });

  it("rejects reusing the current password, weak passwords, and passwords containing the email", async () => {
    await makeUser();
    expect((await changePassword({ currentPassword: PASSWORD, newPassword: PASSWORD })).status).toBe(400);
    expect((await changePassword({ currentPassword: PASSWORD, newPassword: "password123" })).status).toBe(400);
    expect((await changePassword({ currentPassword: PASSWORD, newPassword: "my-alice-passphrase" })).status).toBe(400);
    expect(await verifyPassword(PASSWORD, db.user.__rows[0].passwordHash)).toBe(true);
  });

  it("explains that an OAuth-only account has no password to change", async () => {
    await makeUser({ passwordHash: null });
    const res = await changePassword({ currentPassword: "anything", newPassword: NEW_PASSWORD });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/Google or GitHub/);
  });

  it("throttles repeated attempts (so it can't be used to guess the current password)", async () => {
    await makeUser();
    for (let i = 0; i < 5; i++) await changePassword({ currentPassword: `wrong${i}`, newPassword: NEW_PASSWORD });
    const blocked = await changePassword({ currentPassword: PASSWORD, newPassword: NEW_PASSWORD });
    expect(blocked.status).toBe(429);
    expect(await verifyPassword(PASSWORD, db.user.__rows[0].passwordHash)).toBe(true); // even the right password is refused while throttled
  });
});

describe("sign out everywhere", () => {
  it("requires being signed in", async () => {
    expect((await signOutEverywhereRoute()).status).toBe(401);
  });

  it("sets the session cut-off to now", async () => {
    const user = await makeUser();
    const before = Date.now();
    expect((await signOutEverywhereRoute()).status).toBe(200);
    const row = db.user.__rows.find((r) => r.id === user.id)!;
    expect(row.sessionsValidAfter.getTime()).toBeGreaterThanOrEqual(before - 1000);
    expect(row.passwordHash).toBeTruthy(); // password untouched
  });
});

describe("delete account", () => {
  it("requires being signed in", async () => {
    expect((await deleteAccount({ confirmEmail: "alice@example.com" })).status).toBe(401);
  });

  it("requires typing the account email exactly, and deletes nothing otherwise", async () => {
    await makeUser();
    for (const body of [{ confirmEmail: "bob@example.com" }, { confirmEmail: "" }, {}, { confirmEmail: "alice" }]) {
      expect((await deleteAccount(body)).status).toBe(400);
    }
    expect(db.user.__rows).toHaveLength(1);
  });

  it("deletes the account when confirmed (case-insensitively)", async () => {
    await makeUser();
    expect((await deleteAccount({ confirmEmail: "  ALICE@example.com " })).status).toBe(200);
    expect(db.user.__rows).toHaveLength(0);
  });

  it("cancels an active Stripe subscription first", async () => {
    const user = await makeUser();
    const cancel = vi.fn().mockResolvedValue({});
    vi.mocked(getStripe).mockReturnValue({ subscriptions: { cancel } } as never);
    await db.subscription.create({ data: { userId: user.id, stripeSubscriptionId: "sub_123", status: "active", tier: "PRO" } });

    expect((await deleteAccount({ confirmEmail: "alice@example.com" })).status).toBe(200);
    expect(cancel).toHaveBeenCalledWith("sub_123");
    expect(db.user.__rows).toHaveLength(0);
  });

  it("refuses to delete (and keeps the account) if the subscription can't be cancelled - never leave someone paying for a ghost", async () => {
    const user = await makeUser();
    vi.mocked(getStripe).mockReturnValue({ subscriptions: { cancel: vi.fn().mockRejectedValue(Object.assign(new Error("boom"), { code: "api_connection_error" })) } } as never);
    await db.subscription.create({ data: { userId: user.id, stripeSubscriptionId: "sub_123", status: "active", tier: "PRO" } });

    const res = await deleteAccount({ confirmEmail: "alice@example.com" });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/Cancel it in Settings/);
    expect(db.user.__rows).toHaveLength(1);
  });

  it("proceeds when Stripe says the subscription no longer exists", async () => {
    const user = await makeUser();
    vi.mocked(getStripe).mockReturnValue({ subscriptions: { cancel: vi.fn().mockRejectedValue(Object.assign(new Error("No such subscription"), { code: "resource_missing" })) } } as never);
    await db.subscription.create({ data: { userId: user.id, stripeSubscriptionId: "sub_gone", status: "active", tier: "PRO" } });
    expect((await deleteAccount({ confirmEmail: "alice@example.com" })).status).toBe(200);
  });

  it("doesn't call Stripe for an already-cancelled or free account", async () => {
    const user = await makeUser();
    const cancel = vi.fn();
    vi.mocked(getStripe).mockReturnValue({ subscriptions: { cancel } } as never);
    await db.subscription.create({ data: { userId: user.id, stripeSubscriptionId: "sub_old", status: "canceled", tier: "FREE" } });
    expect((await deleteAccount({ confirmEmail: "alice@example.com" })).status).toBe(200);
    expect(cancel).not.toHaveBeenCalled();
  });
});
