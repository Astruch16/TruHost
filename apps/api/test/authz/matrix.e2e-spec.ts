import { createTestApp, type TestApp } from '../support/app.js';
import { resetDb } from '../support/db.js';
import { listRoutes } from '../support/routes.js';
import { ACTORS, seedWorld, type ActorKey, type World } from '../support/world.js';
import { CASES, type AuthzCase } from './cases.js';

let t: TestApp;
let world: World;

beforeAll(async () => {
  t = await createTestApp();
});
afterAll(async () => {
  await t.close();
});

async function freshWorld() {
  await resetDb(t.prisma);
  world = await seedWorld(t.prisma);
}

function send(c: AuthzCase, subject: string | null) {
  const [method] = c.route.split(' ');
  const agent = t.as(subject);
  const path = c.path(world);
  const body = c.body?.(world);
  switch (method) {
    case 'GET':
      return agent.get(path);
    case 'POST':
      return agent.post(path, body);
    case 'PATCH':
      return agent.patch(path, body);
    case 'PUT':
      return agent.put(path, body);
    case 'DELETE':
      return agent.delete(path);
    default:
      throw new Error(`Unsupported method in ${c.route}`);
  }
}

const allowed = (c: AuthzCase, who: ActorKey) => c.allow === 'everyone' || c.allow.includes(who);

describe('authorization matrix', () => {
  it('covers every route the API serves', () => {
    const served = listRoutes(t.app);
    const covered = new Set(CASES.map((c) => c.route));
    const missing = served.filter((r) => !covered.has(r));
    const stale = [...covered].filter((r) => !served.includes(r));
    expect({ missing, stale }).toEqual({ missing: [], stale: [] });
  });

  describe.each(CASES.map((c) => [c.label ? `${c.route} [${c.label}]` : c.route, c] as const))('%s', (_, c) => {
    beforeAll(freshWorld);

    it.each(ACTORS)('as %s', async (who) => {
      if (c.mutates) await freshWorld();
      const res = await send(c, world.users[who].subject);
      if (allowed(c, who)) {
        expect(res.status, JSON.stringify(res.body)).toBeLessThan(300);
      } else {
        expect(res.status, JSON.stringify(res.body)).toBe(404);
        expect(res.body.code).toBe('NOT_FOUND');
      }
    });

    it('as anonymous', async () => {
      if (c.mutates) await freshWorld();
      const res = await send(c, null);
      expect(res.status).toBe(c.public ? 200 : 401);
    });
  });
});
