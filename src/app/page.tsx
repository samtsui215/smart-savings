import Link from "next/link";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const session = await getSession();
  if (session) redirect("/dashboard");

  return (
    <main className="relative min-h-screen overflow-hidden bg-hero">
      <div className="absolute inset-0 bg-dotted opacity-60 pointer-events-none" />

      <nav className="relative max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Logo />
          <span className="font-semibold tracking-tight">Smart Savings</span>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/login" className="btn-ghost">Sign in</Link>
          <Link href="/register" className="btn-accent">Get started</Link>
        </div>
      </nav>

      <section className="relative max-w-4xl mx-auto px-6 pt-20 pb-32 text-center animate-fade-in">
        <span className="chip-accent">
          <span className="size-1.5 rounded-full bg-accent-500" /> Envelope budgeting, reimagined
        </span>
        <h1 className="mt-6 text-5xl sm:text-6xl font-semibold tracking-tight text-ink-950 leading-[1.05]">
          One balance.<br/>
          <span className="bg-violet-sheen bg-clip-text text-transparent">Every dollar with a purpose.</span>
        </h1>
        <p className="mt-6 max-w-2xl mx-auto text-lg text-ink-600 leading-relaxed">
          Split your savings into virtual buckets for travel, rent, emergencies — anything.
          We guarantee every cent is accounted for, every time.
        </p>
        <div className="mt-10 flex items-center justify-center gap-3">
          <Link href="/register" className="btn-accent text-base px-6 py-3">
            Create your first bucket →
          </Link>
          <Link href="/login" className="btn-secondary text-base px-6 py-3">
            I have an account
          </Link>
        </div>

        <div className="mt-20 grid sm:grid-cols-3 gap-4 text-left">
          <Feature
            title="Atomic accounting"
            body="Every transaction is wrapped in a database transaction. Balances cannot drift — ever."
          />
          <Feature
            title="Visual goals"
            body="Set a target on any bucket and watch progress live. Allocation chart updates instantly."
          />
          <Feature
            title="Can I afford it?"
            body="Type an amount and the app suggests which bucket should fund the expense."
          />
        </div>
      </section>
    </main>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div className="card p-5 card-hover">
      <h3 className="font-medium text-ink-900">{title}</h3>
      <p className="mt-1.5 text-sm text-ink-600 leading-relaxed">{body}</p>
    </div>
  );
}

function Logo() {
  return (
    <div className="size-8 rounded-xl bg-violet-sheen shadow-glow grid place-items-center">
      <svg viewBox="0 0 24 24" className="size-4 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 7h16M4 12h10M4 17h16" />
      </svg>
    </div>
  );
}
