<script lang="ts">
	import IconBase from './IconBase.svelte';
	let props = $props();
</script>

<IconBase {...props}>
	<rect x="3" y="5" width="18" height="14" rx="2" />
	<path d="m3 7 9 6 9-6" />
</IconBase>
