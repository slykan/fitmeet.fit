export default function SlideshowLayout({ children }: { children: React.ReactNode }) {
  return <div className="fixed inset-0 z-[100] bg-black">{children}</div>
}
