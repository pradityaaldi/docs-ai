<script lang="ts">
	import IconBase from './IconBase.svelte';
	let props = $props();
</script>

<IconBase {...props}>
	<circle cx="12" cy="12" r="9" />
	<path d="m8 12 3 3 5-6" />
</IconBase>
