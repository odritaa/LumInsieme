/** Wordmark de la marca. Aparece igual en el navbar y en el hero del login. */
export default function BrandMark({ showDot = true, className = "", style }) {
  return (
    <span className={`brand-mark ${className}`.trim()} style={style}>
      {showDot && <span className="brand-dot" />}
      <span className="brand-lum">Lum</span>
      <span className="brand-insieme">insieme</span>
    </span>
  );
}
