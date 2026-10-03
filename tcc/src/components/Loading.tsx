export default function Loading() {
  return <div class="flex min-h-64 flex-col items-center justify-center gap-4 text-muted" role="status">
    <span class="size-7 rounded-full border-2 border-line border-t-accent motion-safe:animate-spin" aria-hidden="true" />
    <p class="text-sm">Loading…</p>
  </div>;
}
