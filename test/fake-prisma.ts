/* eslint-disable @typescript-eslint/no-explicit-any */
// A small in-memory stand-in for the parts of the Prisma client the app's logic uses, so tests can
// exercise real code paths (rate limiting, tokens, auth routes, usage caps) with no database.
// It implements only what the app calls - equality, gte/lt/in/not filters, composite unique keys,
// {increment}, select, simple orderBy/take - and enforces the unique constraints that matter.

type Row = Record<string, any>;

function matches(row: Row, where: Row = {}): boolean {
  return Object.entries(where).every(([key, value]) => {
    if (value && typeof value === "object" && !(value instanceof Date)) {
      if ("gte" in value && !(row[key] >= value.gte)) return false;
      if ("lt" in value && !(row[key] < value.lt)) return false;
      if ("in" in value && !value.in.includes(row[key])) return false;
      if ("not" in value && row[key] === value.not) return false;
      const isOperator = ["gte", "lt", "in", "not"].some((op) => op in value);
      // Composite unique selector, e.g. { userId_date: { userId, date } }
      if (!isOperator) return Object.entries(value).every(([k, v]) => row[k] === v);
      return true;
    }
    return row[key] === value;
  });
}

function applyUpdate(row: Row, data: Row): void {
  for (const [key, value] of Object.entries(data)) {
    if (value && typeof value === "object" && !(value instanceof Date) && "increment" in value) {
      row[key] = (row[key] ?? 0) + value.increment;
    } else {
      row[key] = value;
    }
  }
}

function pick(row: Row, select?: Row): Row {
  if (!select) return { ...row };
  return Object.fromEntries(Object.keys(select).filter((k) => select[k]).map((k) => [k, row[k]]));
}

function uniqueViolation(fields: string[]): Error {
  return Object.assign(new Error(`Unique constraint failed on the fields: (${fields.join(",")})`), { code: "P2002" });
}

interface ModelOptions {
  uniques?: string[][];
  autoId?: boolean;
  defaults?: () => Row;
}

function makeModel(name: string, options: ModelOptions = {}) {
  const rows: Row[] = [];
  let counter = 0;

  const assertUnique = (candidate: Row, ignore?: Row) => {
    for (const fields of options.uniques ?? []) {
      if (fields.some((f) => candidate[f] === undefined || candidate[f] === null)) continue;
      const clash = rows.find((r) => r !== ignore && fields.every((f) => r[f] === candidate[f]));
      if (clash) throw uniqueViolation(fields);
    }
  };

  const model = {
    __rows: rows,
    __reset: () => {
      rows.length = 0;
      counter = 0;
    },
    async findUnique({ where, select }: { where: Row; select?: Row }) {
      const row = rows.find((r) => matches(r, where));
      return row ? pick(row, select) : null;
    },
    async findFirst({ where, select }: { where?: Row; select?: Row } = {}) {
      const row = rows.find((r) => matches(r, where));
      return row ? pick(row, select) : null;
    },
    async findMany({ where, select, orderBy, take }: { where?: Row; select?: Row; orderBy?: Row; take?: number } = {}) {
      let result = rows.filter((r) => matches(r, where));
      if (orderBy) {
        const [key, dir] = Object.entries(orderBy)[0] as [string, "asc" | "desc"];
        result = [...result].sort((a, b) => (a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0) * (dir === "desc" ? -1 : 1));
      }
      if (take !== undefined) result = result.slice(0, take);
      return result.map((r) => pick(r, select));
    },
    async count({ where }: { where?: Row } = {}) {
      return rows.filter((r) => matches(r, where)).length;
    },
    async create({ data, select }: { data: Row; select?: Row }) {
      const row: Row = { ...(options.defaults?.() ?? {}), ...data };
      if (options.autoId && row.id === undefined) row.id = `${name}_${++counter}`;
      assertUnique(row);
      rows.push(row);
      return pick(row, select);
    },
    async update({ where, data, select }: { where: Row; data: Row; select?: Row }) {
      const row = rows.find((r) => matches(r, where));
      if (!row) throw Object.assign(new Error(`${name} not found`), { code: "P2025" });
      const next = { ...row };
      applyUpdate(next, data);
      assertUnique(next, row);
      applyUpdate(row, data);
      return pick(row, select);
    },
    async updateMany({ where, data }: { where?: Row; data: Row }) {
      const targets = rows.filter((r) => matches(r, where));
      targets.forEach((r) => applyUpdate(r, data));
      return { count: targets.length };
    },
    async upsert({ where, create, update, select }: { where: Row; create: Row; update: Row; select?: Row }) {
      const existing = rows.find((r) => matches(r, where));
      if (existing) {
        applyUpdate(existing, update);
        return pick(existing, select);
      }
      return model.create({ data: create, select });
    },
    async delete({ where }: { where: Row }) {
      const index = rows.findIndex((r) => matches(r, where));
      if (index === -1) throw Object.assign(new Error(`${name} not found`), { code: "P2025" });
      return rows.splice(index, 1)[0];
    },
    async deleteMany({ where }: { where?: Row } = {}) {
      const keep = rows.filter((r) => !matches(r, where));
      const count = rows.length - keep.length;
      rows.length = 0;
      rows.push(...keep);
      return { count };
    },
  };
  return model;
}

export function createFakePrisma() {
  const db = {
    user: makeModel("user", {
      autoId: true,
      uniques: [["email"]],
      defaults: () => ({ name: null, emailVerified: null, image: null, passwordHash: null, sessionsValidAfter: null, createdAt: new Date() }),
    }),
    verificationToken: makeModel("verificationToken", { uniques: [["token"]] }),
    rateLimit: makeModel("rateLimit", { uniques: [["key"]] }),
    aiUsage: makeModel("aiUsage", { autoId: true, uniques: [["userId", "date", "source"]], defaults: () => ({ count: 0 }) }),
    historyItem: makeModel("historyItem", { autoId: true, defaults: () => ({ createdAt: new Date() }) }),
    apiKey: makeModel("apiKey", { autoId: true }),
    subscription: makeModel("subscription", { autoId: true, uniques: [["userId"]], defaults: () => ({ tier: "FREE" }) }),
    workflow: makeModel("workflow", { autoId: true, defaults: () => ({ createdAt: new Date() }) }),
    account: makeModel("account", { autoId: true }),
    async $transaction(ops: Promise<unknown>[]) {
      return Promise.all(ops);
    },
    __reset() {
      Object.values(db).forEach((m: any) => m?.__reset?.());
    },
  };
  return db;
}

export type FakePrisma = ReturnType<typeof createFakePrisma>;
