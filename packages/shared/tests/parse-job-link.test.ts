import { describe, expect, it } from 'vitest'
import { parseJobLink } from '../src/parse-job-link.js'

describe('parseJobLink', () => {
  it('returns empty for blank input', () => {
    expect(parseJobLink('   ')).toMatchObject({ company: '', role: '', confidence: 'none' })
  })

  it('reads Greenhouse, Lever, Ashby, and Workable URLs', () => {
    expect(parseJobLink('https://boards.greenhouse.io/northwind/jobs/123')).toMatchObject({
      company: 'Northwind',
      source: 'greenhouse',
      confidence: 'url',
    })
    expect(parseJobLink('https://jobs.lever.co/spotify/4f2c8a1b-3c1d-4e2a-9b7c-1234567890ab-senior-backend-engineer')).toMatchObject({
      company: 'Spotify',
      role: 'Senior Backend Engineer',
      source: 'lever',
    })
    expect(parseJobLink('https://jobs.ashbyhq.com/notion/product-designer')).toMatchObject({
      company: 'Notion',
      role: 'Product Designer',
      source: 'ashby',
    })
    expect(parseJobLink('https://apply.workable.com/harbor/j/staff-designer')).toMatchObject({
      company: 'Harbor',
      role: 'Staff Designer',
      source: 'workable',
    })
  })

  it('reads SmartRecruiters and LinkedIn slugs', () => {
    expect(parseJobLink('https://jobs.smartrecruiters.com/acme/123-platform-engineer')).toMatchObject({
      company: 'Acme',
      role: 'Platform Engineer',
      source: 'smartrecruiters',
    })
    expect(parseJobLink('https://www.linkedin.com/jobs/view/senior-engineer-at-northwind-traders-38291')).toMatchObject({
      company: 'Northwind Traders',
      role: 'Senior Engineer',
      source: 'linkedin',
    })
  })

  it('lets query parameters override the slug', () => {
    expect(parseJobLink('https://example.com/jobs/1?company=Lumen&role=Writer')).toMatchObject({
      company: 'Lumen',
      role: 'Writer',
    })
  })

  it('parses role-at-company text and separators', () => {
    expect(parseJobLink('Staff Engineer at Northwind')).toMatchObject({
      company: 'Northwind',
      role: 'Staff Engineer',
      confidence: 'text',
    })
    expect(parseJobLink('Product Manager | Harbor')).toMatchObject({
      company: 'Harbor',
      role: 'Product Manager',
    })
    expect(parseJobLink('Northwind — Designer')).toMatchObject({
      company: 'Northwind',
      role: 'Designer',
    })
  })

  it('ignores text that is not a role', () => {
    expect(parseJobLink('just a note')).toMatchObject({ confidence: 'none' })
  })
})
