import { describe, it, expect } from 'vitest'
import { analyzeColumns } from '@/lib/csv-analyzer'
import type { ColumnStats } from '@/lib/csv-analyzer'

describe('csv analyzer', () => {
  describe('type inference', () => {
    it('detects number columns', () => {
      const stats = analyzeColumns(['amount'], [
        { amount: '100.50' }, { amount: '200' }, { amount: '-30.5' },
      ])
      expect(stats[0].inferredType).toBe('number')
    })

    it('detects boolean columns', () => {
      const stats = analyzeColumns(['active'], [
        { active: 'true' }, { active: 'false' }, { active: 'TRUE' },
      ])
      expect(stats[0].inferredType).toBe('boolean')
    })

    it('detects date columns', () => {
      const stats = analyzeColumns(['created'], [
        { created: '2024-01-15' }, { created: '2024-06-30' }, { created: '2023-12-01' },
      ])
      expect(stats[0].inferredType).toBe('date')
    })

    it('falls back to string for mixed types', () => {
      const stats = analyzeColumns(['data'], [
        { data: '100' }, { data: 'hello' }, { data: '200' },
      ])
      expect(stats[0].inferredType).toBe('string')
    })

    it('returns unknown for empty columns', () => {
      const stats = analyzeColumns(['empty'], [
        { empty: '' }, { empty: '' },
      ])
      expect(stats[0].inferredType).toBe('unknown')
    })
  })

  describe('empty percentage', () => {
    it('calculates empty count', () => {
      const stats = analyzeColumns(['col'], [
        { col: 'a' }, { col: '' }, { col: 'b' }, { col: '' },
      ])
      expect(stats[0].emptyCount).toBe(2)
      expect(stats[0].totalCount).toBe(4)
    })

    it('counts zero empties when all filled', () => {
      const stats = analyzeColumns(['col'], [
        { col: 'a' }, { col: 'b' },
      ])
      expect(stats[0].emptyCount).toBe(0)
    })
  })

  describe('sample values', () => {
    it('extracts up to 5 unique sample values', () => {
      const rows = Array.from({ length: 20 }, (_, i) => ({ col: `val${i}` }))
      const stats = analyzeColumns(['col'], rows)
      expect(stats[0].sampleValues.length).toBeLessThanOrEqual(5)
    })

    it('excludes empty values from samples', () => {
      const stats = analyzeColumns(['col'], [
        { col: '' }, { col: 'a' }, { col: '' }, { col: 'b' },
      ])
      expect(stats[0].sampleValues).toEqual(['a', 'b'])
    })
  })

  describe('numeric range', () => {
    it('calculates min and max for number columns', () => {
      const stats = analyzeColumns(['val'], [
        { val: '10' }, { val: '5.5' }, { val: '100' }, { val: '-3' },
      ])
      expect(stats[0].numericRange).toEqual({ min: -3, max: 100 })
    })

    it('does not set range for non-number columns', () => {
      const stats = analyzeColumns(['val'], [
        { val: 'hello' }, { val: 'world' },
      ])
      expect(stats[0].numericRange).toBeUndefined()
    })
  })

  describe('warnings', () => {
    it('warns when empty rate exceeds 20%', () => {
      const stats = analyzeColumns(['col'], [
        { col: '' }, { col: '' }, { col: '' }, { col: 'a' },
      ])
      expect(stats[0].warnings.length).toBeGreaterThan(0)
      expect(stats[0].warnings[0]).toContain('empty')
    })

    it('no warnings for clean data', () => {
      const stats = analyzeColumns(['col'], [
        { col: 'a' }, { col: 'b' }, { col: 'c' },
      ])
      expect(stats[0].warnings).toEqual([])
    })
  })
})
