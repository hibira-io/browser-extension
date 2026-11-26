import { describe, expect, it } from 'vitest';
import { clientID } from '../src/chrome/auth';

describe('clientID', () => {
  it('matches the client hibira.io treats as first party', () => {
    // pusher-server internal/billing: TestExtensionClientIsFirstParty.
    expect(clientID('https://abcdefghijklmnopabcdefghijklmnop.chromiumapp.org/auth/hibira/callback')).toBe(
      'hkc_eyJuIjoiSGliaSBmb3IgQ2hyb21lIiwiciI6WyJodHRwczovL2FiY2RlZmdoaWprbG1ub3BhYmNkZWZnaGlqa2xtbm9wLmNocm9taXVtYXBwLm9yZy9hdXRoL2hpYmlyYS9jYWxsYmFjayJdfQ',
    );
  });
});
