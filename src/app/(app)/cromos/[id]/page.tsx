import Image from "next/image";

export default function CromoDetailPage() {
  return (
    <div className="mt-20">
      <h1 className="center-flex">TONKATSU</h1>
      <h2 className="center-flex">Nos encontramos en construcción</h2>
      <div className="center-flex">
        <Image
          src="/media/img/worker.png"
          alt="Página en construcción"
          width={544}
          height={544}
          priority
          style={{ height: "34rem", width: "34rem" }}
        />
      </div>
    </div>
  );
}
