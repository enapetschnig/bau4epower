export default function Logo({ size = 'md', className = '' }) {
  const heights = {
    sm: 36,
    md: 42,
    lg: 56,
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
