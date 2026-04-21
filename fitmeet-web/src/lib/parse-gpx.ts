export function parseGpx(xml: string): [number, number][] {
  const parser = new DOMParser()
  const doc    = parser.parseFromString(xml, 'text/xml')

  // getElementsByTagNameNS('*', ...) handles GPX files with xmlns declarations
  let nodes: HTMLCollectionOf<Element> | NodeListOf<Element> =
    doc.getElementsByTagNameNS('*', 'trkpt')
  if (nodes.length === 0) nodes = doc.getElementsByTagNameNS('*', 'rtept')
  if (nodes.length === 0) nodes = doc.getElementsByTagNameNS('*', 'wpt')

  return Array.from(nodes)
    .map(n => [
      parseFloat(n.getAttribute('lat') ?? ''),
      parseFloat(n.getAttribute('lon') ?? ''),
    ] as [number, number])
    .filter(([lat, lng]) => !isNaN(lat) && !isNaN(lng))
}
