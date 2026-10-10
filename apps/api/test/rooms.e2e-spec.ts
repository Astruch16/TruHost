import { createTestApp, type TestApp } from './support/app.js';
import { resetDb } from './support/db.js';
import { seedWorld, type World } from './support/world.js';

describe('rooms: types, labels, derived names and order', () => {
  let t: TestApp;
  let w: World;

  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(() => t.close());
  beforeEach(async () => {
    await resetDb(t.prisma);
    w = await seedWorld(t.prisma);
  });

  // Property A starts with a Bedroom and a Bathroom, in that order.
  const path = () => `/v1/properties/${w.propertyA.id}/rooms`;
  const add = (body: object) => t.as('admin').post(path(), body);
  const names = async (who = 'admin') =>
    ((await t.as(who).get(path()).expect(200)).body.items as { displayName: string }[]).map((r) => r.displayName);

  describe('names', () => {
    it('shows numbers once a type has several rooms', async () => {
      expect(await names()).toEqual(['Bedroom', 'Bathroom']);
      const second = await add({ type: 'BEDROOM' }).expect(201);
      expect(second.body).toMatchObject({ displayName: 'Bedroom 2', label: null, number: 2, position: 2 });
      expect(await names()).toEqual(['Bedroom 1', 'Bathroom', 'Bedroom 2']);

      await t.as('admin').patch(`/v1/rooms/${w.propertyA.roomIds[0]}`, { label: 'Primary' }).expect(200);
      expect(await names()).toEqual(['Bedroom · Primary', 'Bathroom', 'Bedroom 2']);

      await t.as('admin').post(`/v1/rooms/${second.body.id}/archive`).expect(200);
      expect(await names()).toEqual(['Bedroom · Primary', 'Bathroom']);
      // Owners and cleaners get the same names.
      expect(await names('ownerA')).toEqual(['Bedroom · Primary', 'Bathroom']);
      expect(await names('cleanerA')).toEqual(['Bedroom · Primary', 'Bathroom']);
    });

    it('never renames a room when the walkthrough is reordered', async () => {
      await t
        .as('admin')
        .post(`${path()}/bulk`, {
          rooms: [{ type: 'BEDROOM' }, { type: 'BEDROOM' }, { type: 'BATHROOM' }, { type: 'KITCHEN' }],
        })
        .expect(201);
      await add({ type: 'BEDROOM', label: 'Loft' }).expect(201);
      const byId = async () => {
        const items = (await t.as('admin').get(path()).expect(200)).body.items as { id: string; displayName: string }[];
        return { ids: items.map((r) => r.id), names: Object.fromEntries(items.map((r) => [r.id, r.displayName])) };
      };
      const before = await byId();
      expect(Object.values(before.names).sort()).toEqual(
        ['Bathroom 1', 'Bathroom 2', 'Bedroom 1', 'Bedroom 2', 'Bedroom 3', 'Bedroom · Loft', 'Kitchen'].sort(),
      );
      const orders = [
        [...before.ids].reverse(),
        [...before.ids.slice(3), ...before.ids.slice(0, 3)],
        [before.ids[4], before.ids[0], before.ids[6], before.ids[2], before.ids[5], before.ids[1], before.ids[3]],
      ];
      for (const order of orders) {
        const res = await t.as('admin').put(`${path()}/order`, { roomIds: order }).expect(200);
        expect(res.body.items.map((r: { id: string }) => r.id)).toEqual(order);
        expect((await byId()).names).toEqual(before.names);
      }
    });

    it('never renumbers the others when a room is deleted', async () => {
      const [first] = w.propertyA.roomIds;
      const two = (await add({ type: 'BEDROOM' }).expect(201)).body;
      const three = (await add({ type: 'BEDROOM' }).expect(201)).body;
      expect(await names()).toEqual(['Bedroom 1', 'Bathroom', 'Bedroom 2', 'Bedroom 3']);
      await t.as('admin').post(`/v1/rooms/${two.id}/archive`).expect(200);
      expect(await names()).toEqual(['Bedroom 1', 'Bathroom', 'Bedroom 3']);
      // Down to one bedroom: it's just "Bedroom" (no number shown), and it keeps its number underneath.
      await t.as('admin').post(`/v1/rooms/${first}/archive`).expect(200);
      const items = (await t.as('admin').get(path()).expect(200)).body.items;
      expect(items.find((r: { id: string }) => r.id === three.id)).toMatchObject({ displayName: 'Bedroom', number: 3 });
    });

    it('numbers new rooms from the next free number, never reusing a deleted room’s', async () => {
      const [first] = w.propertyA.roomIds; // Bedroom, number 1
      const two = (await add({ type: 'BEDROOM' }).expect(201)).body;
      expect(two.number).toBe(2);
      await t.as('admin').post(`/v1/rooms/${two.id}/archive`).expect(200);
      // 2 still belongs to the deleted room (and its photos): the next is 3.
      expect((await add({ type: 'BEDROOM' }).expect(201)).body).toMatchObject({ number: 3, displayName: 'Bedroom 3' });
      // A label hides a number but keeps it: the next is 4, and clearing the label brings back "Bedroom 1".
      await t.as('admin').patch(`/v1/rooms/${first}`, { label: 'Primary' }).expect(200);
      expect((await add({ type: 'BEDROOM' }).expect(201)).body.number).toBe(4);
      const cleared = await t.as('admin').patch(`/v1/rooms/${first}`, { label: null }).expect(200);
      expect(cleared.body).toMatchObject({ number: 1, displayName: 'Bedroom 1' });
      // Changing type moves a room to the next free number of its new type, which frees its old one.
      const moved = await t.as('admin').patch(`/v1/rooms/${first}`, { type: 'OFFICE' }).expect(200);
      expect(moved.body).toMatchObject({ number: 1, displayName: 'Office' });
      expect((await add({ type: 'BEDROOM' }).expect(201)).body.number).toBe(1);
    });

    it('quick setup numbers rooms in the order created', async () => {
      const res = await t
        .as('admin')
        .post(`${path()}/bulk`, {
          rooms: [{ type: 'BATHROOM' }, { type: 'BEDROOM' }, { type: 'BATHROOM' }, { type: 'BEDROOM' }],
        })
        .expect(201);
      expect(res.body.items.map((r: { type: string; number: number }) => `${r.type} ${r.number}`)).toEqual([
        'BEDROOM 1',
        'BATHROOM 1',
        'BATHROOM 2',
        'BEDROOM 2',
        'BATHROOM 3',
        'BEDROOM 3',
      ]);
    });

    it('keeps each number to one room of a type in the database, deleted rooms included', async () => {
      const [bedroom] = w.propertyA.roomIds;
      const two = (await add({ type: 'BEDROOM' }).expect(201)).body;
      await t.as('admin').post(`/v1/rooms/${two.id}/archive`).expect(200);
      await expect(t.prisma.$executeRaw`UPDATE "Room" SET number = 2 WHERE id = ${bedroom}::uuid`).rejects.toThrow(
        /Room_propertyId_type_number_key/,
      );
      await expect(t.prisma.$executeRaw`UPDATE "Room" SET number = 0 WHERE id = ${bedroom}::uuid`).rejects.toThrow(
        /room_number_positive/,
      );
    });

    it('tidies labels and treats a blank one as none', async () => {
      const res = await add({ type: 'LIVING', label: '  Upstairs   loft ' }).expect(201);
      expect(res.body).toMatchObject({ label: 'Upstairs loft', displayName: 'Living room · Upstairs loft' });
      const cleared = await t.as('admin').patch(`/v1/rooms/${res.body.id}`, { label: '   ' }).expect(200);
      expect(cleared.body).toMatchObject({ label: null, displayName: 'Living room' });
    });

    it('changes a room’s type', async () => {
      const res = await t.as('admin').patch(`/v1/rooms/${w.propertyA.roomIds[1]}`, { type: 'HALF_BATH' }).expect(200);
      expect(res.body.displayName).toBe('Half bath');
    });
  });

  describe('no two rooms share a name', () => {
    it('refuses a second room with the same type and label, ignoring case and spacing', async () => {
      await add({ type: 'BEDROOM', label: 'Primary' }).expect(201);
      const dup = await add({ type: 'BEDROOM', label: '  primary ' }).expect(409);
      expect(dup.body).toMatchObject({ code: 'ROOM_NAME_TAKEN', name: 'Bedroom · primary' });
      expect(dup.body.detail).toContain('Bedroom · primary');
      // The same label on another type is a different name.
      await add({ type: 'BATHROOM', label: 'Primary' }).expect(201);
    });

    it('refuses a change that would make two names the same', async () => {
      await add({ type: 'BEDROOM', label: 'Loft' }).expect(201);
      const res = await t.as('admin').patch(`/v1/rooms/${w.propertyA.roomIds[0]}`, { label: 'LOFT' }).expect(409);
      expect(res.body.code).toBe('ROOM_NAME_TAKEN');
      // Moving a labelled room to a type that already has that label collides too.
      const office = await add({ type: 'OFFICE', label: 'Loft' }).expect(201);
      await t.as('admin').patch(`/v1/rooms/${office.body.id}`, { type: 'BEDROOM' }).expect(409);
    });

    it('frees a name when its room is deleted (archived)', async () => {
      const first = await add({ type: 'BEDROOM', label: 'Primary' }).expect(201);
      await t.as('admin').post(`/v1/rooms/${first.body.id}/archive`).expect(200);
      await add({ type: 'BEDROOM', label: 'Primary' }).expect(201);
    });

    it('refuses quick setup that would repeat a name, and adds nothing', async () => {
      const before = await t.prisma.room.count();
      const res = await t
        .as('admin')
        .post(`${path()}/bulk`, {
          rooms: [
            { type: 'OFFICE', label: 'Den' },
            { type: 'OFFICE', label: 'den' },
          ],
        })
        .expect(409);
      expect(res.body.code).toBe('ROOM_NAME_TAKEN');
      expect(await t.prisma.room.count()).toBe(before);
    });

    it('is enforced by the database too', async () => {
      const [bedroom, bathroom] = w.propertyA.roomIds;
      await t.prisma.$executeRaw`UPDATE "Room" SET label = 'Primary' WHERE id = ${bedroom}::uuid`;
      await expect(
        t.prisma
          .$executeRaw`UPDATE "Room" SET type = 'BEDROOM', label = 'PRIMARY', number = 2 WHERE id = ${bathroom}::uuid`,
      ).rejects.toThrow(/room_label_unique/);
      // Archived rooms don't count.
      await t.prisma.$executeRaw`UPDATE "Room" SET "archivedAt" = now() WHERE id = ${bedroom}::uuid`;
      await t.prisma
        .$executeRaw`UPDATE "Room" SET type = 'BEDROOM', label = 'PRIMARY', number = 2 WHERE id = ${bathroom}::uuid`;
    });
  });

  describe('Other rooms', () => {
    it('need a label', async () => {
      const res = await add({ type: 'OTHER' }).expect(400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
      const cellar = await add({ type: 'OTHER', label: 'Wine cellar' }).expect(201);
      expect(cellar.body.displayName).toBe('Other · Wine cellar');
      const cleared = await t.as('admin').patch(`/v1/rooms/${cellar.body.id}`, { label: null }).expect(422);
      expect(cleared.body.code).toBe('ROOM_LABEL_REQUIRED');
      await t.as('admin').patch(`/v1/rooms/${w.propertyA.roomIds[0]}`, { type: 'OTHER' }).expect(422);
    });

    it('are checked by the database, along with tidy labels', async () => {
      const [bedroom] = w.propertyA.roomIds;
      await expect(t.prisma.$executeRaw`UPDATE "Room" SET type = 'OTHER' WHERE id = ${bedroom}::uuid`).rejects.toThrow(
        /room_other_has_label/,
      );
      for (const bad of [' Primary', '', 'x'.repeat(61)]) {
        await expect(
          t.prisma.$executeRaw`UPDATE "Room" SET label = ${bad} WHERE id = ${bedroom}::uuid`,
        ).rejects.toThrow(/room_label_tidy/);
      }
    });
  });

  describe('quick setup', () => {
    it('adds rooms at the end in the order given and returns them all, named', async () => {
      const res = await t
        .as('admin')
        .post(`${path()}/bulk`, {
          rooms: [{ type: 'BEDROOM' }, { type: 'KITCHEN' }, { type: 'PATIO_DECK' }, { type: 'HOT_TUB' }],
        })
        .expect(201);
      expect(res.body.items.map((r: { displayName: string; position: number }) => [r.displayName, r.position])).toEqual(
        [
          ['Bedroom 1', 0],
          ['Bathroom', 1],
          ['Bedroom 2', 2],
          ['Kitchen', 3],
          ['Patio/Deck', 4],
          ['Hot tub', 5],
        ],
      );
    });

    it('is for admins only, and caps a property at 100 rooms', async () => {
      await t
        .as('ownerA')
        .post(`${path()}/bulk`, { rooms: [{ type: 'KITCHEN' }] })
        .expect(404);
      await t.prisma.room.createMany({
        data: Array.from({ length: 97 }, (_, i) => ({
          propertyId: w.propertyA.id,
          type: 'OFFICE' as const,
          label: `Desk ${i}`,
          number: i + 1,
          position: 10 + i,
        })),
      });
      const res = await t
        .as('admin')
        .post(`${path()}/bulk`, { rooms: [{ type: 'KITCHEN' }, { type: 'LIVING' }] })
        .expect(422);
      expect(res.body.code).toBe('TOO_MANY_ROOMS');
    });
  });

  describe('migration from free-text names', () => {
    // The rule the migration applied to existing rooms (kept as a database function so it can be checked here).
    it.each([
      ['BEDROOM', 'Bedroom', null],
      ['BEDROOM', 'bedroom 2', null],
      ['BEDROOM', 'Bedroom #3', null],
      ['BEDROOM', '1', null],
      ['BEDROOM', 'Primary bedroom', 'Primary bedroom'],
      ['BEDROOM', '  Kids   room ', 'Kids room'],
      ['BATHROOM', 'Bath room', null],
      ['BATHROOM', 'Ensuite', 'Ensuite'],
      ['LIVING', 'Living', null],
      ['LIVING', 'Living Room 2', null],
      ['DINING', 'Dining room', null],
      ['LAUNDRY', 'Laundry room', null],
      ['ENTRY', 'Entryway', null],
      ['ENTRY', 'Mud Room', 'Mud Room'],
      ['PATIO_DECK', 'Outdoor', null],
      ['PATIO_DECK', 'Deck', null],
      ['PATIO_DECK', 'Rooftop deck', 'Rooftop deck'],
      ['KITCHEN', 'Kitchenette', 'Kitchenette'],
      ['OTHER', 'Other', 'Other'],
      ['OTHER', 'Pullout couch', 'Pullout couch'],
      ['OTHER', '', 'Other'],
      ['BEDROOM', 'x'.repeat(80), 'x'.repeat(60)],
    ])('%s “%s” → %s', async (type, name, label) => {
      const [row] = await t.prisma.$queryRaw<{ label: string | null }[]>`
        SELECT room_label_from_name(${type}, ${name}) AS label`;
      expect(row!.label).toBe(label);
    });
  });
});
