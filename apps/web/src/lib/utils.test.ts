import test from 'node:test';
import assert from 'node:assert';
import { cn } from './utils.ts';

test('cn utility integration', async (t) => {
  await t.test('should merge simple strings', () => {
    const result = cn('bg-red-500', 'p-4');
    assert.ok(result.includes('bg-red-500'));
    assert.ok(result.includes('p-4'));
  });

  await t.test('should handle conditional classes', () => {
    const result = cn('bg-red-500', { 'p-4': true, 'm-2': false });
    assert.ok(result.includes('bg-red-500'));
    assert.ok(result.includes('p-4'));
    assert.ok(!result.includes('m-2'));
  });

  await t.test('should handle arrays', () => {
    const result = cn(['bg-red-500', 'p-4']);
    assert.ok(result.includes('bg-red-500'));
    assert.ok(result.includes('p-4'));
  });

  await t.test('should handle falsy values', () => {
    const result = cn('bg-red-500', null, undefined, false, '');
    assert.strictEqual(result.trim(), 'bg-red-500');
  });

  await t.test('should resolve tailwind conflicts (via mock twMerge)', () => {
    const result = cn('p-2', 'p-4');
    // Our mock twMerge handles prefix-based merging
    assert.strictEqual(result.trim(), 'p-4');
  });
});
