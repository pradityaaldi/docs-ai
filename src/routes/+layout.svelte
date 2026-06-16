<script lang="ts">
	import '../app.css';
	import { ConfirmModal } from '$lib/components/ui';
	let { children } = $props();
</script>

{@render children()}
<ConfirmModal />
