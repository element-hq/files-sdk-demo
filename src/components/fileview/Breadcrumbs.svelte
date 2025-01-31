<!--
Copyright 2021, 2022 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
-->

<script lang="ts">
    import router from 'page';
    import Button from "@smui/button";
    import type { IEntry, IFolderEntry } from "matrix-files-sdk";

    export let directory!: IFolderEntry | undefined;

    // TODO react to changes in hierarchy
    let linkTree: IFolderEntry[] = [];

    $: {
        linkTree = [];
        let next: IEntry | undefined = directory;
        while (next) {
            linkTree.push(next as IFolderEntry);
            next = next.parent;
        }
        // take root off:
        linkTree.pop();
        linkTree.reverse();
        linkTree = linkTree;
    }
</script>

<div>
    <Button on:click:preventDefault={() => router.show('/home')} href="#" variant="text">Home</Button>
    {#each linkTree as item}
        <span class="material-icons-round">chevron_right</span>
        <Button on:click:preventDefault={() => router.show(`/directory/${item.id}`)} href="#" variant="text">{item.name}</Button>
    {/each}
</div>

<style lang="scss">
    div {
        display: flex;
        align-items: center;
        padding-left: 14px;
    }
    .material-icons-round {
        color: #C1C6CD !important;
    }
    a {
        text-decoration: none;
        &:visited {
            color: unset;
        }
    }
</style>
