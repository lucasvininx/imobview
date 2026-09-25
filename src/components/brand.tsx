import Image from "next/image";
import Link from "next/link";
export function Brand() {
  return (
    <Link href="/" className="brand" aria-label="ImobView — página inicial">
      <Image
        src="/brand/imobview-logo.png"
        width={1024}
        height={224}
        alt="ImobView°"
        priority
      />
    </Link>
  );
}
