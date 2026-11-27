export function Avatar({
  name,
  color,
  size = 28,
}: {
  name: string;
  color: string;
  size?: number;
}) {
  const letter = name.trim().charAt(0).toUpperCase() || "?";
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-full font-medium text-white"
      style={{ background: color, width: size, height: size, fontSize: Math.max(11, size * 0.42) }}
    >
      {letter}
    </span>
  );
}
