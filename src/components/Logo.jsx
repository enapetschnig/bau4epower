export default function Logo({ size = 'md', className = '' }) {
  const heights = {
    sm: 72,
    md: 66,
    lg: 84,
  }

  return (
    <div className={className}>
      <img
        src="/Logo_B4Y_transparent.png"
        alt="BAU4YOU Baranowski Bau GmbH"
        style={{ height: heights[size], width: 'auto' }}
      />
    </div>
  )
}
