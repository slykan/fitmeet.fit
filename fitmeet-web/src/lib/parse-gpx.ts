export function parseGpx(xml: string): [number, number][] {
  const parser = new DOMParser()
  const doc    = parser.parseFromString(xml, 'text/xml')

  let nodes = doc.querySelectorAll('trkpt')
  if (nodes.length === 0) nodes = doc.querySelectorAll('rtept')
  if (nodes.length === 0) nodes = doc.querySelectorAll('wpt')

  return Array.from(nodes)
    .map(n => [
      parseFloat(n.getAttribute('lat') ?? ''),
      parseFloat(n.getAttribute('lon') ?? ''),
    ] as [number, number])
    .filter(([lat, lng]) => !isNaN(lat) && !isNaN(lng))
}
