<!--
Copyright 2021, 2022 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
-->

<script lang="ts">
    import type { IEntry } from "matrix-files-sdk";
    import RelativeDate from './RelativeDate.svelte';

    export let entry: IEntry;
    export let lastModified = false;
    
    let date: Date | null = null;

    $: (async () => {
        if (lastModified) {
            date = await entry.getLastModifiedDate() ?? null;
        } else {
            date = await entry.getCreationDate() ?? null;
        }
    })();
</script>

<RelativeDate date={date} />

<style>
</style>
