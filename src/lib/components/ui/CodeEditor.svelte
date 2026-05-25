<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { EditorState, Compartment } from '@codemirror/state';
	import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from '@codemirror/view';
	import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
	import { bracketMatching, indentOnInput, foldGutter, foldKeymap, syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';
	import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
	import { json } from '@codemirror/lang-json';
	import { oneDark } from '@codemirror/theme-one-dark';

	type Props = {
		value: string;
		onChange?: (v: string) => void;
		onBlur?: () => void;
		onFocus?: () => void;
		placeholder?: string;
	};

	let { value = $bindable(''), onChange, onBlur, onFocus, placeholder = '' }: Props = $props();

	let container = $state<HTMLDivElement>();
	let view: EditorView | undefined;
	let updating = false;

	onMount(() => {
		if (!container) return;
		const state = EditorState.create({
			doc: value,
			extensions: [
				lineNumbers(),
				highlightActiveLineGutter(),
				highlightActiveLine(),
				history(),
				foldGutter(),
				indentOnInput(),
				bracketMatching(),
				closeBrackets(),
				syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
				json(),
				oneDark,
				keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...historyKeymap, ...foldKeymap, indentWithTab]),
				EditorView.lineWrapping,
				EditorView.theme({
					'&': { height: '100%', fontSize: '13px', backgroundColor: 'var(--bg-base)' },
					'.cm-scroller': { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace', lineHeight: '1.6' },
					'.cm-gutters': { backgroundColor: 'var(--bg-subtle)', border: 'none' },
					'&.cm-focused': { outline: 'none' },
					'.cm-content': { padding: '12px 0' }
				}),
				EditorView.updateListener.of((u) => {
					if (u.docChanged && !updating) {
						const v = u.state.doc.toString();
						value = v;
						onChange?.(v);
					}
				}),
				EditorView.domEventHandlers({
					blur: () => { onBlur?.(); },
					focus: () => { onFocus?.(); }
				})
			]
		});
		view = new EditorView({ state, parent: container });
	});

	$effect(() => {
		if (!view) return;
		const current = view.state.doc.toString();
		if (value !== current) {
			updating = true;
			view.dispatch({ changes: { from: 0, to: current.length, insert: value ?? '' } });
			updating = false;
		}
	});

	export function setValue(v: string) {
		value = v;
	}

	onDestroy(() => {
		view?.destroy();
	});
</script>

<div bind:this={container} class="h-full w-full" data-placeholder={placeholder}></div>

<style>
	:global(.cm-editor) {
		height: 100%;
	}
</style>
