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
    import type { IEntry, IFolderEntry } from "matrix-files-sdk";

    export let directory!: IFolderEntry | undefined;

    // TODO react to changes in hierarchy
    let linkTree: IFolderEntry[] = [];

    $: {
        linkTree = [];
        let next: IEntry | undefined = directory;
        while (next) {
            linkTree.push(next as IFolderEntry);
            next = next.getParent();
        }
        // take root off:
        linkTree.pop();
        linkTree.reverse();
        linkTree = linkTree;
    }
</script>

<div>
    <a href="/#!/home">Home</a>
    {#each linkTree as item}
        <span class="material-icons-round">chevron_right</span>
        <a href="/#!/directory/{item.id}">{item.getName()}</a>
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
