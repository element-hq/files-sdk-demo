<!--
Copyright 2021, 2022 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
-->

<script type="ts">
    import { errorWrapper } from "../../utils";
    import type { IFolderEntry, IFolderMembership } from "matrix-files-sdk";
    import { FolderRole } from 'matrix-files-sdk';
    import IconButton from "@smui/icon-button";
    import DataTable, { Head, Row, Cell, Body } from "@smui/data-table";
    import Select, { Option } from '@smui/select';
    import { onDestroy } from "svelte";

    export let folder: IFolderEntry;

    let inviteUserId: string;
    let inviteSent = false;

    let members = folder.members;

    const member = folder.ownMembership;

    let memberBeingEdited: IFolderMembership | null = null;
    let editedMemberRole: FolderRole | null = null;

    function onModified() {
        members = members;
    }

    folder.on('modified', onModified);
    onDestroy(() => folder.off('modified', onModified));

    async function kick(m: IFolderMembership) {
        await errorWrapper(async () => {
            await folder.removeMember(m.userId);
            members = folder.members;
        }, `Failed to remove ${m.userId}`);
    }

    function edit(m: IFolderMembership) {
        memberBeingEdited = m;
        editedMemberRole = m.role;
    }

    async function save() {
        if (!memberBeingEdited) {
            return;
        }
        const m = memberBeingEdited;
        await errorWrapper(async () => {
            await folder.setMemberRole(m.userId, editedMemberRole!);
            memberBeingEdited = null;
            editedMemberRole = null;
            members = folder.members;
        }, `Failed to set permissions for ${m.userId}`);
        members = members;
    }

    function cancel() {
        memberBeingEdited = null;
        editedMemberRole = null;
    }

    async function invite() {
        inviteSent = false;
        await errorWrapper(async () => {
            await folder.inviteMember(inviteUserId, FolderRole.Viewer);
            members = folder.members;
            inviteUserId = "";
            inviteSent = true;
        }, `Failed to invite ${inviteUserId}`);
    }

    const roles = [FolderRole.Owner, FolderRole.Editor, FolderRole.Viewer];

    function mapRole(role: FolderRole): string {
        switch (role) {
            case FolderRole.Owner:
                return 'Owner';
            case FolderRole.Editor:
                return 'Editor';
            case FolderRole.Viewer:
                return 'Viewer';
        }
    }
</script>

<DataTable style="width: 100%; border: none;">
    <Head>
        <Row class="header">
            <Cell>User</Cell>
            <Cell>Role</Cell>
            <Cell></Cell>
        </Row>
    </Head>
    <Body>
        {#each members as member}
            <Row>
                <Cell>
                    {member.userId}
                </Cell>
                <Cell>
                    {#if memberBeingEdited?.userId === member.userId}
                        <Select bind:value={editedMemberRole}>
                            {#each roles as role}
                                <Option value={role}>{mapRole(role)}</Option>
                            {/each}
                        </Select>
                        <IconButton class="material-icons-round" on:click={() => save()} variant="unelevated">
                            save
                        </IconButton>
                        <IconButton class="material-icons-round" on:click={() => cancel()} variant="unelevated">
                            cancel
                        </IconButton>
                    {:else}
                        {mapRole(member.role)}
                        <IconButton class="material-icons-round" on:click={() => edit(member)} disabled={!!memberBeingEdited || member.role === FolderRole.Owner || !member.canManageRoles} variant="unelevated">
                            edit
                        </IconButton>
                    {/if}
                </Cell>
                <Cell>
                    <IconButton class="material-icons-round" on:click={() => kick(member)} disabled={!!memberBeingEdited || member.role === FolderRole.Owner || !member.canRemove} variant="unelevated">
                        delete
                    </IconButton>
                </Cell>
            </Row>
        {/each}
    </Body>
</DataTable>
<tr>
    <td colspan="3">
        <form on:submit|preventDefault={invite}>
            <input type="text" placeholder="@user:example.org" bind:value={inviteUserId} />
            <button type="submit" disabled={!member.canInvite}>Invite as viewer</button>
            {#if inviteSent} Sent! {/if}
        </form>
    </td>
</tr>

<style>
    /* :global(.material-icons-round) {
        width: 24px;
        color: #C1C6CD !important;
    } */
</style>