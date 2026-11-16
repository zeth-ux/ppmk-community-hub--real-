/** PPMK mark: lion, Jalur Gemilang crescent and star, hibiscus, open book, inside an engineering gear. */
export default function LogoMark({ size = 44 }: { size?: number }) {
  return (
    <picture className="shrink-0">
      <source srcSet="/logo.webp" type="image/webp" />
      <img
        src="/logo.png"
        width={size}
        height={size}
        alt=""
        aria-hidden
        decoding="async"
        className="shrink-0 select-none object-contain"
      />
    </picture>
  )
}
