<script lang="ts">
	import IconBase from './IconBase.svelte';
	let props = $props();
</script>

<IconBase {...props}>
	<circle cx="12" cy="12" r="9" />
	<path d="m15 9-6 6M9 9l6 6" />
</IconBase>
