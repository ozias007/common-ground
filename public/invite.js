// Invite links: one person's picks travel inside the URL, so the other person can add theirs.
// No accounts and no database; whoever has the link can read the picks, which the UI says plainly.
const ID = /^[0-9A-F-]{36}$/i;
const GROUPS = ['grandparent', 'couple', 'parent_teen', 'carer', 'first_date', 'friends'];

const toBase64Url = text => btoa(String.fromCharCode(...new TextEncoder().encode(text))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromBase64Url = code => new TextDecoder().decode(Uint8Array.from(atob(code.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)));

// Compact on purpose: the whole thing has to fit comfortably in a WhatsApp message.
export function encodeInvite({ groupType, city, point, people }) {
  return toBase64Url(JSON.stringify({
    g: groupType,
    c: city || undefined,
    p: point ? [point.lat, point.lon] : undefined,
    n: people.map(p => [p.name, p.favourites.map(f => [f.id, f.name, f.type])]),
  }));
}

// Returns null for anything that doesn't look exactly like an invite we made.
export function decodeInvite(code) {
  try {
    const d = JSON.parse(fromBase64Url(code));
    if (!GROUPS.includes(d.g) || !Array.isArray(d.n) || d.n.length < 2 || d.n.length > 5) return null;
    const people = d.n.map(([name, favs]) => {
      if (typeof name !== 'string' || name.length > 40 || !Array.isArray(favs) || favs.length > 8) throw 0;
      return {
        name,
        favourites: favs.map(([id, title, type]) => {
          if (!ID.test(id) || typeof title !== 'string' || title.length > 200 || typeof type !== 'string' || type.length > 20) throw 0;
          return { id, name: title, type };
        }),
      };
    });
    const point = Array.isArray(d.p) && d.p.length === 2 && d.p.every(Number.isFinite) && Math.abs(d.p[0]) <= 90 && Math.abs(d.p[1]) <= 180
      ? { lat: d.p[0], lon: d.p[1] } : null;
    return { groupType: d.g, city: typeof d.c === 'string' ? d.c.slice(0, 100) : '', point, people };
  } catch {
    return null;
  }
}
