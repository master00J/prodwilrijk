export const SITES = ['Wilrijk', 'Genk', 'Willebroek', 'Weert'] as const

export type Site = (typeof SITES)[number]

export const DEFAULT_SITE: Site = 'Wilrijk'

export function normalizeSite(value: unknown): Site {
  const site = String(value || '').trim()
  return SITES.includes(site as Site) ? (site as Site) : DEFAULT_SITE
}

export function normalizeSites(value: unknown): Site[] {
  if (!Array.isArray(value)) return [DEFAULT_SITE]
  const sites = value
    .map(normalizeSite)
    .filter((site, index, all) => all.indexOf(site) === index)
  return sites.length > 0 ? sites : [DEFAULT_SITE]
}

export function employeeHasSite(employee: { sites?: string[] | null }, site: string): boolean {
  const employeeSites = employee.sites && employee.sites.length > 0 ? employee.sites : [DEFAULT_SITE]
  return employeeSites.includes(site)
}
