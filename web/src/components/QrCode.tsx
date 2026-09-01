import { useMemo } from 'react';
import qrcode from 'qrcode-generator';

export interface QrCodeProps {
  value: string;
  /** Rendered edge length in CSS pixels. The SVG scales, so this is layout only. */
  size?: number;
  /** Announced to a screen reader, which cannot read the modules. */
  title: string;
  className?: string;
}

/**
 * A QR code as inline SVG.
 *
 * Always black on white, in both themes and deliberately: a scanner wants
 * contrast in one known polarity, and this is a thing that gets printed and
 * taped to a wall. Theme tokens would make the dark-mode version invert, which
 * many phone cameras will not read.
 */
export function QrCode({ value, size = 176, title, className = '' }: QrCodeProps) {
  const { path, count } = useMemo(() => {
    // The default build maps each char to its low byte, which is exact for
    // ASCII and wrong for anything else. Invite URLs are ASCII by
    // construction (`URLSearchParams` percent-encodes); a hand-typed
    // non-ASCII hostname is the one way in, so encode that rather than
    // silently emitting a QR that scans to mojibake.
    // eslint-disable-next-line no-control-regex
    const payload = /^[\x00-\x7F]*$/.test(value) ? value : encodeURI(value);
    // Type 0 picks the smallest version that fits; M survives a fold or a
    // thumbprint without doubling the module count.
    const qr = qrcode(0, 'M');
    qr.addData(payload);
    qr.make();
    const n = qr.getModuleCount();
    // One path for the whole symbol: a rect per dark module is thousands of
    // nodes, and this is re-rendered on every keystroke in the password box.
    let d = '';
    for (let row = 0; row < n; row += 1) {
      for (let col = 0; col < n; col += 1) {
        if (qr.isDark(row, col)) d += `M${col} ${row}h1v1h-1z`;
      }
    }
    return { path: d, count: n };
  }, [value]);

  // Four modules of quiet zone, which the spec requires and scanners rely on.
  const margin = 4;
  const extent = count + margin * 2;
  return (
    <svg
      role="img"
      aria-label={title}
      viewBox={`0 0 ${extent} ${extent}`}
      width={size}
      height={size}
      shapeRendering="crispEdges"
      className={`rounded-lg ${className}`}
    >
      <rect width={extent} height={extent} fill="#ffffff" />
      <g transform={`translate(${margin} ${margin})`}>
        <path d={path} fill="#000000" />
      </g>
    </svg>
  );
}
