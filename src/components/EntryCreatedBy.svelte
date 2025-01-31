<!--
Copyright 2021, 2022 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
-->

<script lang="ts">
    import type { IEntry } from "matrix-files-sdk";
    import { Skeleton } from 'svelte-loading-skeleton';
    export let entry: IEntry;
    
    let userId: string | undefined;
    let loaded = false;

    $: (async () => {
        userId = await entry.getCreatedByUserId() ?? '-';
        loaded = true;
    })();
</script>

{#if loaded}
    <span>{userId}</span>
{:else}
    <Skeleton />
{/if}

<style>
</style>
