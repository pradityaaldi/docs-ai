<script lang="ts">
	import IconBase from './IconBase.svelte';
	let props = $props();
</script>

<IconBase {...props}>
	<path d="M15 3H9a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7z" />
	<path d="M15 3v4h4" />
	<path d="M5 7v12a2 2 0 0 0 2 2h8" />
</IconBase>
