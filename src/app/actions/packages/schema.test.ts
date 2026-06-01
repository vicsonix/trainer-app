import { packageSchema } from './schema'

describe('packageSchema', () => {
  it('accepts valid input', () => {
    const result = packageSchema.safeParse({ name: 'Test', visit_count: '10', price: '800' })
    expect(result.success).toBe(true)
  })

  it('rejects empty name', () => {
    const result = packageSchema.safeParse({ name: '', visit_count: '10', price: '800' })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues.some(i => i.path[0] === 'name')).toBe(true)
  })

  it('rejects negative visit_count', () => {
    const result = packageSchema.safeParse({ name: 'X', visit_count: '-1', price: '800' })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues.some(i => i.path[0] === 'visit_count')).toBe(true)
  })

  it('rejects zero visit_count', () => {
    const result = packageSchema.safeParse({ name: 'X', visit_count: '0', price: '800' })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues.some(i => i.path[0] === 'visit_count')).toBe(true)
  })

  it('rejects negative price', () => {
    const result = packageSchema.safeParse({ name: 'X', visit_count: '10', price: '-5' })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues.some(i => i.path[0] === 'price')).toBe(true)
  })

  it('accepts zero price (free package)', () => {
    const result = packageSchema.safeParse({ name: 'X', visit_count: '10', price: '0' })
    expect(result.success).toBe(true)
  })

  it('coerces string inputs to numbers', () => {
    const result = packageSchema.safeParse({ name: 'X', visit_count: '10', price: '800' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.visit_count).toBe(10)
  })
})
