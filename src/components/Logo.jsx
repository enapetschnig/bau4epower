export default function Logo({ size = 'md', className = '' }) {
  const heights = {
    sm: 24,
    md: 32,
    lg: 40,
  }

  return (
    <div className={className}>
      <img
        src="/logo-napetschnig.png"
        alt="NAPETSCHNIG."
        style={{ height: heights[size], width: 'auto' }}
      />
    </div>
  )
}
