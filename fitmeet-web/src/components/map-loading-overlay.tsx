export function MapLoadingOverlay() {
  return (
    <div className="absolute inset-0 z-[600] flex items-center justify-center pointer-events-none">
      <div className="map-spin h-10 w-10 rounded-full border-4 border-white/20 border-t-white" />
    </div>
  )
}
