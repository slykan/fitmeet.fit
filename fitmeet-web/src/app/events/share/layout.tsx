// /events/share/?id= (rendered in the browser) is noindex via page.tsx;
// pre-rendered /events/share/<id>/ pages contain the event and are indexable (in the sitemap).
export default function ShareLayout({ children }: { children: React.ReactNode }) {
  return children
}
