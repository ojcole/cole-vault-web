<script lang="ts">
	let { children } = $props();
	const base = import.meta.env.BASE_URL;
</script>

<svelte:head>
	<link rel="icon" href={`${base}favicon.png`} type="image/png" />
</svelte:head>

{@render children()}
