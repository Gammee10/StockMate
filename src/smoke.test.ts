import { describe, it, expect } from 'vitest';

describe('Tooling Smoke Test', () => {
  it('runs unit tests and verifies basic invariants', () => {
    const cashTotal = 5000; // 50.00 ETB in cents
    const digitalTotal = 2500; // 25.00 ETB in cents
    expect(cashTotal + digitalTotal).toBe(7500);
  });
});
