// Global confirmation dialog. Call `confirmAction({...})` from anywhere (actions,
// components) → returns a Promise<boolean> that resolves when the user picks.
// A single <ConfirmModal/> (mounted in the root layout) renders this state.

export interface ConfirmOptions {
	title?: string;
	message: string;
	confirmText?: string;
	cancelText?: string;
	variant?: 'danger' | 'primary';
}

class ConfirmState {
	open = $state(false);
	title = $state('Konfirmasi');
	message = $state('');
	confirmText = $state('Ya');
	cancelText = $state('Batal');
	variant = $state<'danger' | 'primary'>('danger');
	#resolve: ((v: boolean) => void) | null = null;

	ask(opts: ConfirmOptions): Promise<boolean> {
		this.title = opts.title ?? 'Konfirmasi';
		this.message = opts.message;
		this.confirmText = opts.confirmText ?? 'Ya';
		this.cancelText = opts.cancelText ?? 'Batal';
		this.variant = opts.variant ?? 'danger';
		this.open = true;
		return new Promise((res) => {
			this.#resolve = res;
		});
	}

	#settle(v: boolean) {
		if (!this.open) return;
		this.open = false;
		const r = this.#resolve;
		this.#resolve = null;
		r?.(v);
	}

	confirm() {
		this.#settle(true);
	}

	cancel() {
		this.#settle(false);
	}
}

export const confirmStore = new ConfirmState();

export function confirmAction(opts: ConfirmOptions): Promise<boolean> {
	return confirmStore.ask(opts);
}
