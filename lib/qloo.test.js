// Live smoke check against Qloo (needs QLOO_API_KEY): npm test
import assert from 'node:assert';
import { searchEntity, insights, swaps, nearby } from './qloo.js';

const [jim] = await searchEntity({ query: 'Jim Reeves', type: 'artist' });
const [burna] = await searchEntity({ query: 'Burna Boy', type: 'artist' });
assert.strictEqual(jim.name, 'Jim Reeves');

const films = await insights({ seedIds: [jim.id, burna.id], category: 'movie' }); // blended group taste
assert.ok(films.length > 0, 'bridges returned nothing');

const swap = await swaps({ fromSeeds: [burna.id], toSeeds: [jim.id], category: 'artist' });
assert.ok(swap.length > 0 && !swap.some(e => e.id === burna.id), 'swaps should exclude the seed itself');

const places = await nearby({ seeds: [jim.id], location: 'Johannesburg' });
assert.ok(places.length > 0, 'nearby returned nothing');

console.log('ok', { films: films.slice(0, 3).map(e => e.name), swap: swap[0].name, place: places[0].name });
