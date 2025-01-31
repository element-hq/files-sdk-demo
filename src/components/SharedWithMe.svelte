<!--
Copyright 2021, 2022 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
-->

<svelte:head>
    <title>Shared with me</title>
</svelte:head>

<script lang="ts">
	import router from "page";
    import type { ClientManager } from "../ClientManager";
    import { onDestroy, onMount } from "svelte";
    import DataTable, { Head, Body, Row, Cell } from '@smui/data-table';
    import type { Room } from "matrix-js-sdk/lib";
    import { errorWrapper } from "../utils";
    import Button, { Label } from '@smui/button';

    export let clientManager: ClientManager;
    
    let shares: Share[] = [];

    interface Share {
        sharedBy: string;
        accepted: boolean;
        id: string;
        name: string;
        room?: Room;
    }

    async function loadWorkspaces() {
        const filtered: Share[] = [];

        const invites = await clientManager.files.getPendingInvites();
        for (const x of invites) {
            filtered.push({
                sharedBy: '',
                accepted: false,
                id: x.roomId,
                name: x.name,
                room: x,
            });
        }


        const ourUid = clientManager.client.getUserId();
        const unfiltered = await clientManager.files.getChildren();
        for (const x of unfiltered) {
            const xUid = await x.getCreatedByUserId();
            if (xUid && xUid !== ourUid) {
                filtered.push({
                    accepted: true,
                    name: x.name,
                    id: x.id,
                    sharedBy: xUid,
                });
            }
        }

        shares = filtered;
    }


    onMount(() => {
        loadWorkspaces();
        clientManager.on('modified', loadWorkspaces);
    });

    onDestroy(() => {
        clientManager.off('modified', loadWorkspaces);
    });

    async function acceptInvite(invite: Share) {
        await errorWrapper(async () => {
            if (!invite.room) {
                return;
            }
            await clientManager.files.acceptInvite(invite.room);
        }, `Failed to accept invite to ${invite.name}`);
    }
</script>

<div>
    <Button on:click:preventDefault={() => router.show('/shared')} href="#" variant="text">Shared with me</Button>
</div>

<DataTable style="width: 100%; border: none;">
    <Head>
        <Row>
            <Cell></Cell>
            <Cell>Name</Cell>
            <Cell>Shared by</Cell>
            <Cell>Accepted</Cell>
        </Row>
    </Head>
    <Body>

        {#each shares as share}
            <Row class="cursor-pointer" on:dblclick:preventDefault={() => share.accepted && router.show(`/directory/${share.id}`)}>
                <Cell><span class="material-icons-round solo-icon">work</span></Cell>
                <Cell>{share.name}</Cell>
                <Cell>{share.sharedBy}</Cell>
                <Cell>
                    {#if share.accepted}
                    {:else}
                        <Button on:click={() => acceptInvite(share)}><Label>Accept</Label></Button>
                    {/if}
                </Cell>
            </Row>
        {/each}
    </Body>
</DataTable>

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
