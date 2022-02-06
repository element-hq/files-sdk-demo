<!--
Copyright 2021-2022 New Vector Ltd.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
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
