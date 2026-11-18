import { describe, expect, it } from 'vitest';
import { trainingKeys } from './trainingQueries';

describe('trainingQueries', () => {
  it('builds deterministic query keys for training catalog', () => {
    expect(trainingKeys.all).toEqual(['training']);
    expect(trainingKeys.catalog()).toEqual(['training', 'catalog']);
  });
});
