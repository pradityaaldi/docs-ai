<script lang="ts">
	// Loading placeholder shown while a project's workspace boots (tree + docs fetch).
	// Mirrors the real 3-pane layout so there's no layout shift when content swaps in.
</script>

<div class="flex h-dvh overflow-hidden bg-[var(--bg-subtle)] p-3">
	<!-- Sidebar -->
	<div class="hidden h-full w-[292px] shrink-0 flex-col overflow-hidden rounded-xl border border-[var(--border-base)] bg-[var(--bg-base)] shadow-sm lg:flex">
		<div class="flex h-14 shrink-0 items-center gap-2 border-b border-[var(--border-base)] px-4">
			<div class="h-7 w-7 animate-pulse rounded-md bg-[var(--bg-component)]"></div>
			<div class="h-3.5 w-28 animate-pulse rounded bg-[var(--bg-component)]"></div>
		</div>
		<div class="flex flex-col gap-2.5 p-4">
			{#each Array(7) as _, i}
				<div class="h-8 animate-pulse rounded-lg bg-[var(--bg-component)]" style="width: {[88, 72, 95, 64, 80, 90, 70][i]}%"></div>
			{/each}
		</div>
	</div>

	<div class="flex min-w-0 flex-1 overflow-hidden bg-[var(--bg-base)] lg:ml-3 lg:rounded-xl lg:border lg:border-[var(--border-base)] lg:shadow-sm">
		<!-- Chat pane -->
		<div class="flex w-full flex-col bg-[var(--bg-base)] lg:w-[42%] lg:min-w-[420px] lg:border-r lg:border-[var(--border-base)]">
			<div class="flex h-14 shrink-0 items-center gap-2 border-b border-[var(--border-base)] px-4">
				<div class="h-7 w-7 animate-pulse rounded-md bg-[var(--bg-component)]"></div>
				<div class="flex flex-col gap-1.5">
					<div class="h-3 w-24 animate-pulse rounded bg-[var(--bg-component)]"></div>
					<div class="h-2.5 w-36 animate-pulse rounded bg-[var(--bg-component)]"></div>
				</div>
			</div>
			<div class="flex flex-1 flex-col gap-4 px-5 py-5">
				<div class="h-16 w-3/4 animate-pulse self-start rounded-xl bg-[var(--bg-component)]"></div>
				<div class="h-24 w-4/5 animate-pulse self-end rounded-xl bg-[var(--bg-component)]"></div>
				<div class="h-12 w-2/3 animate-pulse self-start rounded-xl bg-[var(--bg-component)]"></div>
			</div>
			<div class="border-t border-[var(--border-base)] p-4">
				<div class="h-[110px] w-full animate-pulse rounded-xl bg-[var(--bg-component)]"></div>
			</div>
		</div>

		<!-- Document preview pane -->
		<div class="hidden min-w-0 flex-1 flex-col bg-[var(--bg-subtle)] lg:flex">
			<div class="flex h-14 shrink-0 items-center justify-between border-b border-[var(--border-base)] bg-[var(--bg-base)] px-4">
				<div class="h-3.5 w-40 animate-pulse rounded bg-[var(--bg-component)]"></div>
				<div class="flex items-center gap-1.5">
					<div class="h-8 w-24 animate-pulse rounded-lg bg-[var(--bg-component)]"></div>
					<div class="h-8 w-14 animate-pulse rounded-lg bg-[var(--bg-component)]"></div>
					<div class="h-8 w-14 animate-pulse rounded-lg bg-[var(--bg-component)]"></div>
				</div>
			</div>
			<div class="flex flex-1 justify-center overflow-hidden py-10">
				<div class="h-full w-[min(70%,612px)] animate-pulse rounded-sm bg-[var(--bg-component)] shadow-sm"></div>
			</div>
		</div>
	</div>
</div>
