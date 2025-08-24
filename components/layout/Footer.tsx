export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="py-10 border-t border-zinc-200/60 dark:border-zinc-800/60">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-zinc-600 dark:text-zinc-400">
          <div>© {year} DigiPants. All rights reserved.</div>
          <div className="flex items-center gap-4">
            <a className="hover:underline" href="/privacy/">Privacy</a>
            <a className="hover:underline" href="/terms/">Terms</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
