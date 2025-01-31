<!--
Copyright 2021, 2022 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
-->

<script lang="ts">
    import Dialog, { Title, Content, Actions } from '@smui/dialog';
    import Button from '@smui/button';
    import List, { Item, Graphic, Separator, Text } from '@smui/list';
    import MenuSurface, { MenuSurfaceComponentDev } from '@smui/menu-surface';
    import DataTable, { Head, Body, Row, Cell } from '@smui/data-table';
    import router from 'page';
    import TextfieldDialog from "../TextfieldDialog.svelte";
    import { errorWrapper, setMenuPositions, workspaceNameValidator } from "../../utils";
    import type { IFolderEntry } from "matrix-files-sdk";
    import EntryDate from "../EntryDate.svelte";
    import FolderPermissions from './FolderPermissions.svelte';
    import { toasts } from 'svelte-toasts';
    
    export let workspaces: IFolderEntry[];

    let permissionsFor: IFolderEntry;

    async function remove(workspace: IFolderEntry) {
        workspaceMenu.setOpen(false);
        await errorWrapper(async () => {
            await workspace.delete();
            toasts.success(`Deleted ${workspace.name}`, { duration: 4000, showProgress: true });
        }, `Failed to delete workspace ${workspace.name}`);
        workspaces = workspaces;
    }

    function permissions(workspace: IFolderEntry) {
        permissionsDialog = true;
        workspaceMenu.setOpen(false);
        permissionsFor = workspace;
    }

    let selectedWorkspace: IFolderEntry;
    let workspaceMenu: MenuSurfaceComponentDev;

    function openWorkspaceMenu(folder: IFolderEntry, e: Event) {
        selectedWorkspace = folder;
        workspaceMenu.setOpen(true);
        setMenuPositions(e as PointerEvent);
    }

    async function renameWorkspace(workspace: IFolderEntry) {
        workspaceMenu.setOpen(false);
        const name = await textfieldDialog.open('Rename workspace', workspace.name, 'Workspace name', 'Rename', workspaceNameValidator(workspace.name, workspaces));
        if (name) {
            await errorWrapper(async () => {
                await workspace.rename(name);
            }, `Failed to rename ${workspace.name}`);
            workspaces = workspaces;
        }
    }

    let textfieldDialog: TextfieldDialog;

    let permissionsDialog = false;
</script>

<TextfieldDialog bind:this={textfieldDialog} />

<MenuSurface bind:this={workspaceMenu} anchor={false} quickOpen>
    {#if selectedWorkspace}
        <List dense>
            <Item on:SMUI:action={() => renameWorkspace(selectedWorkspace)}>
                <Graphic class="material-icons-round">drive_file_rename_outline</Graphic>
                <Text>Rename</Text>
            </Item>
            <Separator />
            <Item on:SMUI:action={() => permissions(selectedWorkspace)}>
                <Graphic class="material-icons-round">supervised_user_circle</Graphic>
                <Text>Permissions</Text>
            </Item>
            <Separator />
            <Item on:SMUI:action={() => remove(selectedWorkspace)}>
                <Graphic class="material-icons-round">delete</Graphic>
                <Text>Delete</Text>
            </Item>
        </List>
    {/if}
</MenuSurface>

<DataTable style="width: 100%; border: none;">
    <Head>
        <Row>
            <Cell></Cell>
            <Cell>
                Name
            </Cell>
            <Cell>Created</Cell>
        </Row>
    </Head>
    <Body>

        {#each workspaces as workspace}
            <Row class="cursor-pointer" on:dblclick:preventDefault={() => router.show(`/directory/${workspace.id}`)}  on:contextmenu:preventDefault={(e) => openWorkspaceMenu(workspace, e)} on:mousedown:preventDefault={() => {}}>
                <Cell><span class="material-icons-round solo-icon">work</span></Cell>
                <Cell>{workspace.name}</Cell>
                <Cell><EntryDate entry={workspace} /></Cell>
            </Row>
        {/each}
    </Body>
</DataTable>

<Dialog
    bind:open={permissionsDialog}
    on:MDCDialog:closed={() => { permissionsDialog = false; }}
    surface$style="width: fit-content; max-width: calc(100vw - 32px);"
>
    {#if permissionsFor}
        <Title style="font-size: 24px; font-weight: 600;">Permissions for {permissionsFor.name}</Title>
        <Content>
            <FolderPermissions folder={permissionsFor} />
        </Content>
    {/if}
    <Actions>
        <Button variant="unelevated">
            Close
        </Button>
    </Actions>
</Dialog>

<style>
    .material-icons-round {
        width: 24px;
        color: #C1C6CD !important;
    }
</style>
