const NOT_IMPLEMENTED = 'Calculator nog niet geïmplementeerd'

export function calculatorNotImplemented(productLabel: string): never {
  throw new Error(`${NOT_IMPLEMENTED} voor producttype ${productLabel}`)
}
