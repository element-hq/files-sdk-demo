<!--
Copyright 2021, 2022 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
-->

<script lang="ts">
    import type { IFileEntry } from "matrix-files-sdk";
    import { Skeleton } from 'svelte-loading-skeleton';
    export let entry: IFileEntry;   
    
    let size: string | null = null;

    $: (async () => {
        const bytes = await entry.getSize();
        if (typeof bytes === 'number') {
            if (bytes >= 0) {
                size = fileSize(bytes);
            } else {
                size = '-';
            }
        } else {
            size = null;
        }
    })();


    function fileSize(bytes: number): string {
        const sizes = ['B', 'kB', 'MB', 'GB', 'TB'];
        let idx = 0;
        while (bytes > 1000 && idx < sizes.length) {
            idx++;
            bytes = bytes/1000;
        }
        return `${bytes.toFixed(0)} ${sizes[idx]}`;
    }

</script>

{#if size}
    <span>{size}</span>
{:else if entry.encryptionStatus === 'decryptionFailed'}
    Unable to decrypt
{:else if entry.encryptionStatus === 'decryptionPending'}
    <Skeleton />
{:else}
    {entry.encryptionStatus}
{/if}

<style>
</style>
