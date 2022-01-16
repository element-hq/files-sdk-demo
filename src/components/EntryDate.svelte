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
