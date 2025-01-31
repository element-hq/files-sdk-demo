<!--
Copyright 2021, 2022 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
-->

<svelte:head>
    <title>{title}</title>
</svelte:head>

<script lang="ts">
    import type { ClientManager } from "../ClientManager";
    import Listing from "./fileview/Listing.svelte";
    import Workspaces from "./workspaces/Workspaces.svelte";
    import Breadcrumbs from "./fileview/Breadcrumbs.svelte";
    import Dropzone from "svelte-file-dropzone";
    import type { IFolderEntry } from "matrix-files-sdk";
    import { toasts } from "svelte-toasts";
    import { Skeleton } from 'svelte-loading-skeleton';

    export let clientManager!: ClientManager;
    export let directoryId!: string | undefined;
    export let workspaces!: IFolderEntry[];

    let title = '';

    $: title = !directoryId ? 'Home' : `${directory?.parent?.parent ? `... > ${directory?.parent?.name}` : 'Home'} > ${directory?.name ?? ''}`;

    let directory: IFolderEntry | undefined = undefined;

    function onModified() {
        directory = directory;
    }

    let loading = true;
    $: (async () => {
        if (directoryId && directory?.id !== directoryId) {
            const descendent = await clientManager.files.getDescendentById(directoryId);
            if (descendent?.isFolder) {
                directory = descendent as IFolderEntry;
                directory.on('modified', onModified)
                loading = false;
            } else {
                if (directory) {
                    directory.off('modified', onModified)
                }
                directory = undefined;
                toasts.error(`Unable to find folder: ${directoryId}`);
            }
        } else if (!directoryId) {
            if (directory) {
                directory.off('modified', onModified)
            }
            loading = false;
            directory = undefined;
        }
    })();

    async function handleFileDropped(e: Event) {
        dragLeave();
        if (!listing) {
            return;
        }
        // TODO: fix up typings
        const { acceptedFiles } = (e as any).detail;
        await listing.uploadFiles(acceptedFiles);
    }

    async function uploadFiles(e: Event) {
        if (!listing) {
            return;
        }
        // TODO: fix up typings
        await listing.uploadFiles((e.target as any).files);
    }

    export async function newFolder() {
        if (!listing) {
            return;
        }
        await listing.newFolder();
    }

    export async function newFile() {
        if (!listing) {
            return;
        }
        await listing.newFile();
    }

    export function fileUpload() {
        if (!fileSelect) {
            return;
        }
        fileSelect.click();
    }

    let fileSelect: HTMLInputElement | undefined;
    let listing: Listing | undefined;
    let dropzone: HTMLDivElement | undefined;

    function dragEnter() {
        if (!dropzone) {
            return;
        }
        dropzone.classList.add('drag-over');
    }

    function dragLeave() {
        if (!dropzone) {
            return;
        }
        dropzone.classList.remove('drag-over');
    }
</script>

<div class="browser">
    {#if loading}
        <Skeleton />
    {:else}
        {#if directory || !directoryId}
            <Breadcrumbs {directory} />
        {/if}
        {#if directory}
            <div bind:this={dropzone} class="dropzone-container">
                <Dropzone on:drop={handleFileDropped} on:dragenter={dragEnter} on:dragleave={dragLeave} noClick accept={undefined}>
                    <Listing bind:this={listing} {clientManager} {directory} />
                </Dropzone>
            </div>
            <input
                type="file"
                autocomplete="off"
                tabindex="-1"
                on:change={uploadFiles}
                bind:this={fileSelect}
                style="display: none;"
                multiple
            />
        {:else if !directoryId}
            <Workspaces {workspaces} />
        {/if}
    {/if}
</div>


<style>
    .browser {
        margin-left: 8px;
        margin-right: 8px;
    }
    .dropzone-container {
        height: 100%;
    }
    :global(.dropzone) {
        height: 100%;
        border: none !important;
        padding: 0 !important;
        background-color: transparent !important;
    }

    :global(.dropzone-container.drag-over) {
        background: rgba(0, 0, 0, 0.05);
    }
    :global(.mdc-data-table) {
        background: transparent !important;
    }
</style>
