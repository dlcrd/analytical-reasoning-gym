import Link from "next/link";

export default function Home() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-24">
      <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">Analytical Reasoning Gym</h1>
      <p className="text-zinc-600 dark:text-zinc-300">
        Treino de raciocínio analítico: população, grain, definição de métrica e arquitetura de
        query — não só sintaxe SQL.
      </p>
      <Link
        href="/placement"
        className="w-fit rounded-full bg-zinc-900 px-5 py-2.5 text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        Fazer o Teste de Nivelamento
      </Link>
    </div>
  );
}
