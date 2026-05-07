export default function Logo({ size = 'md', className = '' }) {
  const heights = {
    xs: 24,
    sm: 32,
    md: 44,
    lg: 64,
    xl: 96,
  }

  return (
    <div className={className}>
      <img
        src="/logo-etk.png"
        alt="ET KÖNIG GmbH"
        style={{ height: heights[size], width: 'auto' }}
      />
    </div>
  )
}
