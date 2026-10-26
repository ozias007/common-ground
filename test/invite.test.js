// Invite links are untrusted input arriving in a URL, so decoding must reject anything odd.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeInvite, decodeInvite } from '../public/invite.js';

const invite = {
  groupType: 'first_date',
  city: 'Durban, KwaZulu-Natal, South Africa',
  point: { lat: -29.86, lon: 31.01 },
  people: [
    { name: 'Naledi', favourites: [{ id: 'AFC7571E-5679-4362-8643-697BA0F60D0B', name: 'Miriam Makeba', type: 'artist' }] },
    { name: 'Tumi ✨', favourites: [] }, // non-ASCII names must survive the round trip
  ],
};

test('an invite survives the round trip', () => {
  assert.deepEqual(decodeInvite(encodeInvite(invite)), invite);
});

test('a link fits easily in a message', () => {
  assert.ok(encodeInvite(invite).length < 400);
});

test('broken or tampered links are rejected', () => {
  const tamper = change => {
    const d = JSON.parse(Buffer.from(encodeInvite(invite), 'base64url').toString());
    change(d);
    return Buffer.from(JSON.stringify(d)).toString('base64url');
  };
  assert.equal(decodeInvite('not-base64!!'), null);
  assert.equal(decodeInvite(tamper(d => { d.g = 'stranger'; })), null);
  assert.equal(decodeInvite(tamper(d => { d.n = [d.n[0]]; })), null);
  assert.equal(decodeInvite(tamper(d => { d.n[0][1][0][0] = '<script>'; })), null);
  assert.equal(decodeInvite(tamper(d => { d.n[0][0] = 'x'.repeat(41); })), null);
  assert.equal(decodeInvite(tamper(d => { d.p = [999, 0]; })).point, null, 'a bad location is dropped, not trusted');
});
