import Link from "next/link";

export default function Home() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-24">
      <h1 className="text-3xl font-semibold">Analytical Reasoning Gym</h1>
      <p className="text-zinc-600">
        Treino de raciocínio analítico: população, grain, definição de métrica e arquitetura de
        query — não só sintaxe SQL.
      </p>
      <Link
        href="/placement"
        className="w-fit rounded-full bg-black px-5 py-2.5 text-white hover:bg-zinc-800"
      >
        Fazer o Teste de Nivelamento
      </Link>
    </div>
  );
}
