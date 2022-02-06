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
    import router from 'page';
    import List, { Item, Graphic, Text, Separator } from '@smui/list';
    import type { IFolderEntry } from 'matrix-files-sdk';
    import { onDestroy, onMount } from 'svelte';
    import type { ClientManager } from '../ClientManager';
    import url from "../url";
    import { sortEntries } from '../utils';

    export let clientManager: ClientManager;

    let isLoggedIn = clientManager.authedState.value;

    clientManager.authedState.onUpdate(authed => {
        isLoggedIn = authed;
    });

    let workspaces: IFolderEntry[] = [];

    async function onModified() {
        workspaces = sortEntries(await clientManager.files.getChildren()) as IFolderEntry[];
    }

    clientManager.on('modified', onModified);
    onDestroy(() => clientManager.off('modified', onModified));
    onMount(onModified);

    let hash = $url.hash;

    $: hash = $url.hash;
</script>

{#if isLoggedIn}
<List class="sidebar">
    <Item on:click:preventDefault={() => router.show('/home')} href="#" selected={hash === '#!/home'}>
        <Graphic class="material-icons-round">home</Graphic>
        <Text>Home</Text>
    </Item>
    {#each workspaces as workspace}
        <Item on:click:preventDefault={() => router.show(`/directory/${workspace.id}`)} href="#" selected={hash.startsWith(`#!/directory/${workspace.id}`)}>
            <Graphic class="material-icons-round">work</Graphic>
            <Text>{workspace.name}</Text>
        </Item>
    {/each}
    <Separator />
    <Item on:click:preventDefault={() => router.show('/shared')} href="#" selected={hash.startsWith('#!/shared')}>
        <Graphic class="material-icons-round">people_outline</Graphic>
        <Text>Shared with me</Text>
    </Item>
    <Item disabled>
        <Graphic class="material-icons-round">delete</Graphic>
        <Text>Trash</Text>
    </Item>
</List>
{/if}

<style>
    :global(.sidebar .material-icons-round) {
        color: #8D97A5 !important;
    }

    :global(.sidebar .mdc-deprecated-list-item--selected .material-icons-round) {
        color: #fff !important;
    }

    :global(.sidebar .mdc-deprecated-list-item:not(.mdc-deprecated-list-item--selected)) {
        color: #17191C !important;
    }

    :global(.mdc-deprecated-list-item--selected) {
        background-color: var(--mdc-theme-primary) !important;
        color: #fff !important;
        font-weight: 600 !important;
    }
</style>
