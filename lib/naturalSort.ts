const naturalStringCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base',
})

export const compareNaturalStrings = (a: string, b: string) => naturalStringCollator.compare(a, b)
