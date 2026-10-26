// Input checks on POST /api/agent. These guard the server, so each rule gets a case.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validate } from '../api/agent.js';

const fav = { id: 'E36D3B36-915A-470B-ACC7-82BF4849E93C', name: 'Jim Reeves', type: 'artist' };
const person = name => ({ name, favourites: [fav] });
const body = (extra = {}) => ({ groupType: 'grandparent', people: [person('Gogo'), person('Sipho')], ...extra });

test('accepts a normal request', () => {
  assert.equal(validate(body()), null);
  assert.equal(validate(body({ people: ['A', 'B', 'C', 'D', 'E'].map(person) })), null);
});

test('rejects bad requests with a plain-English reason', () => {
  const cases = [
    [undefined, 'Pick who the people are.'],
    [body({ groupType: 'stranger' }), 'Pick who the people are.'],
    [body({ people: [person('Gogo')] }), 'Add 2 to 5 people.'],
    [body({ people: ['A', 'B', 'C', 'D', 'E', 'F'].map(person) }), 'Add 2 to 5 people.'],
    [body({ groupType: 'couple', people: ['A', 'B', 'C'].map(person) }), 'A couple is two people.'],
    [body({ groupType: 'first_date', people: ['A', 'B', 'C'].map(person) }), 'A first date is two people.'],
    [body({ people: [person('Gogo'), { name: 'Sipho', favourites: [] }] }), 'Each person needs a name and 1 to 8 favourites.'],
    [body({ people: [person('Gogo'), { name: 'Sipho', favourites: [{ ...fav, id: 'not-an-id' }] }] }), 'Each person needs a name and 1 to 8 favourites.'],
    [body({ people: [person('Gogo'), person(' gogo ')] }), 'Give everyone a different name.'],
    [body({ city: 'x'.repeat(101) }), 'City is too long.'],
    [body({ point: { lat: null, lon: null } }), 'That location could not be read.'],
    [body({ point: { lat: -29.8, lon: 31 } , city: 'Durban' }), null],
    [body({ point: { lat: 95, lon: 31 } }), 'That location could not be read.'],
    [body({ point: { lat: '1) OR (1', lon: 31 } }), 'That location could not be read.'],
    [body({ point: { lat: 1, lon: 2, extra: 3 } }), 'That location could not be read.'],
    [body({ history: new Array(6).fill({}) }), 'Too much history.'],
  ];
  for (const [input, reason] of cases) assert.equal(validate(input), reason, JSON.stringify(input)?.slice(0, 80));
});
