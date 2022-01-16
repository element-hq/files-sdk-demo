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
    import type { ClientManager } from "../../ClientManager";
    import { onDestroy, onMount } from "svelte";
    import { fileIcon, errorWrapper, itemNameValidator, setMenuPositions } from "../../utils";
    import Dialog, { Title, Content, Actions } from '@smui/dialog';
    import Button, { Label } from '@smui/button';
    import List, { Item, Graphic, Separator, Text } from '@smui/list';
    import DataTable, { Head, Body, Row, Cell } from '@smui/data-table';
    import Checkbox from '@smui/checkbox';
    import TextfieldDialog from "../TextfieldDialog.svelte";
    import MenuSurface, { MenuSurfaceComponentDev } from '@smui/menu-surface';
	import router from "page";
    import { toasts } from 'svelte-toasts';
    import type { IFolderEntry, IFileEntry, IEntry, BranchEntry } from "matrix-files-sdk";
    import EntryDate from "../EntryDate.svelte";
    import EntrySize from "../EntrySize.svelte";
    import EntryCreatedBy from "../EntryCreatedBy.svelte";
    import IconButton from "@smui/icon-button";
    import { Icon } from '@smui/button';
    import Accordion, { Section } from "svelte-accordion";
    import { JsonView } from '@zerodevx/svelte-json-view'
    import EncryptionKeyRestoreDialog from "../EncryptionKeyRestoreDialog.svelte";
    import EncryptionKeyCreateDialog from '../EncryptionKeyCreateDialog.svelte';

    export let clientManager: ClientManager;
    export let directory: IFolderEntry;

    const urlsToRevoke: string[] = [];
    let childrenFetchedForDirectory: string | null = null;
    let selected: IEntry[] = [];
    let subdirectories: IFolderEntry[] = [];
    let files: IFileEntry[] = [];

    let versionHistory: IFileEntry[];

    function onModified() {
        childrenFetchedForDirectory = null;
    }

    directory.on('modified', onModified);

    onDestroy(() => {
        urlsToRevoke.forEach(u => URL.revokeObjectURL(u));
        directory.off('modified', onModified);
    });

    let needsDecryption = false;
    let needsDecryptionDismissed = false;

    $: (async () => {
        if (childrenFetchedForDirectory === directory.id) {
            return;
        }
        childrenFetchedForDirectory = null;
        const children = await directory.getChildren();
        const currDirectories = subdirectories.map(d => ({...d})) || [];
        const currFiles = files.map(d =>  ({...d})) || [];

        subdirectories = children.filter(c => c.isFolder).map(c => c as IFolderEntry).map(d => {
            let existing = currDirectories.find(s => s.id === d.id);

            if (existing) {
                existing = {...existing};
            }

            return d;
        }).sort((a, b) => a.getName().localeCompare(b.getName()));
        files = children.filter(c => !c.isFolder).map(c => c as IFileEntry).map(f => {
            let existing = currFiles.find(s => s.id === f.id);

            if (existing) {
                existing = {...existing};
            }

            return f;
        }).sort((a, b) => a.getName().localeCompare(b.getName()));
        childrenFetchedForDirectory = directory.id;

        needsDecryption = files.some(x => ['encrypted', 'decryptionFailed'].includes(x.getEncryptionStatus()));
    })();

    async function removeDir(dir: IFolderEntry) {
        folderMenu.setOpen(false);
        await errorWrapper(async () => {
            await dir.delete();
        }, `Failed to delete folder ${dir.getName()}`);
    }

    async function removeFile(file: IFileEntry) {
        fileMenu.setOpen(false);
        await errorWrapper(async () => {
            await file.delete();
        }, `Failed to delete file ${file.getName()}`);
    }

    async function downloadFile(file: IFileEntry) {
        fileMenu.setOpen(false);
        if (await errorWrapper(async () => {
            let start: any | undefined;
            try {
                start = toasts.info(`Downloading ${file.getName()}...`);
                const { data, mimetype } = await file.getBlob();
                const anchor = document.createElement("a");
                anchor.href = URL.createObjectURL(new Blob([data], { type: mimetype }));
                anchor.download = file.getName();
                anchor.click();
                start.remove();
                toasts.success(`Downloaded ${file.getName()}`, { duration: 4000, showProgress: true });
            } catch (err) {
                if (start) {
                    start.remove();
                }
                throw err;
            }
        }, `Failed to download ${file.getName()}`)) {
            needsDecryptionDismissed = false;
        }
    }

    async function setLocked(file: IFileEntry, state: boolean) {
        fileMenu.setOpen(false);
        await errorWrapper(async () => {
            await file.setLocked(state);
        }, `Failed to ${state ? '' : 'un'}lock file ${file.getName()}`);
        files = files;
    }

    async function viewHistoryFile(file: IFileEntry) {
        fileMenu.setOpen(false);
        if (await errorWrapper(async () => {
            versionHistory = await file.getVersionHistory();
            historyDialog = true;
        }, `Failed to get version history for ${file.getName()}`)) {
            needsDecryptionDismissed = false;
        };
    }
    
    export async function newFolder() {
        const name = await textfieldDialog.open('New folder', 'Untitled folder', 'Folder name', 'Create', itemNameValidator(undefined, subdirectories, files));
        if (name) {
            await errorWrapper(async () => {
                await directory.addFolder(name);
            }, `Failed to create folder ${name}`);
        }
    }

    let textfieldDialog: TextfieldDialog;
    let selectedFile: IFileEntry;
    let fileMenu: MenuSurfaceComponentDev;

    function openFileMenu(file: IFileEntry, e: Event) {
        selectedFile = file;
        folderMenu.setOpen(false);
        fileMenu.setOpen(true);
        setMenuPositions(e as PointerEvent);
    }

    async function renameFile(file: IFileEntry) {
        fileMenu.setOpen(false);
        const name = await textfieldDialog.open('Rename file', file.getName(), 'File name', 'Rename', itemNameValidator(file.getName(), subdirectories, files));
        if (name) {
            await errorWrapper(async () => {
                await file.rename(name);
            }, `Failed to rename file ${file.getName()}`);
        }
    }

    let selectedFolder: IFolderEntry;
    let folderMenu: MenuSurfaceComponentDev;

    function openFolderMenu(folder: IFolderEntry, e: Event) {
        selectedFolder = folder;
        fileMenu.setOpen(false);
        folderMenu.setOpen(true);
        setMenuPositions(e as PointerEvent);
    }

    async function renameFolder(folder: IFolderEntry) {
        folderMenu.setOpen(false);
        const name = await textfieldDialog.open('Rename folder', folder.getName(), 'Folder name', 'Rename', itemNameValidator(folder.getName(), subdirectories, files));
        if (name) {
            await errorWrapper(async () => {
                await folder.rename(name);
            }, `Failed to rename folder ${folder.getName()}`);
        }
    }

    export async function uploadFiles(newFiles: File[]) {
        for (const file of newFiles) {
            await errorWrapper(async () => {
                // if existing file then upload as new version
                const start = toasts.info(`Uploading ${file.name}...`);
                await directory.addFile(file.name, { data: await file.arrayBuffer(), mimetype: file.type, size: file.size });
                if (start.remove) {
                    start.remove();
                }
                toasts.success(`Uploaded ${file.name}`, { duration: 4000, showProgress: true });
            }, `Failed to upload ${file.name}`);
        }
    }

    let viewSourceBranch: BranchEntry | undefined;
    let viewSourceFileEvent: any | undefined;
    let viewSourceDialog = false;
    async function viewSource(file: IFileEntry) {
        fileMenu.setOpen(false);
        if (await errorWrapper(async () => {
            viewSourceBranch = file as any as BranchEntry;
            viewSourceFileEvent = undefined;
            try {
                viewSourceFileEvent = await viewSourceBranch.branch.getFileEvent();
            } catch (err) {
            }
            viewSourceDialog = true;
        }, `Failed to get version history for ${file.getName()}`)) {
            needsDecryptionDismissed = false;
        }
    }

    let historyDialog = false;
    let keyBackupRestoreDialog = false;
    let keyBackupExists = false;
    let keyBackupCreateDialog = false;
    let needsKeyBackupDismissed = false;
    let deviceCount = 1;

    async function keyBackupCreateDialogClosed() {
        keyBackupCreateDialog = false;
        await keyBackupStatus();
    }

    async function keyBackupStatus() {
        keyBackupExists = await clientManager.crypto.isKeyBackupAvailable();
        deviceCount = (await clientManager.client.getDevices()).devices.length;
    }

    onMount(() => {
        keyBackupStatus();
        clientManager.on('keyBackupStatus', keyBackupStatus);
    });
    onDestroy(() => {
        clientManager.off('keyBackupStatus', keyBackupStatus);
    });
</script>

{#if needsDecryption && !needsDecryptionDismissed}
<div class="alert-banner">
    <Icon class="material-icons-round">warning</Icon>
    <div>
    You are missing encryption keys for some of your files
    </div>
    <div>
        <Button on:click={() => keyBackupRestoreDialog = true}>Help me fix this</Button>
        <Button on:click={() => needsDecryptionDismissed = true} secondary>Dismiss</Button>    
    </div>
</div>
{/if}

<EncryptionKeyRestoreDialog {clientManager} open={keyBackupRestoreDialog} closed={() => keyBackupRestoreDialog = false}/>

{#if !keyBackupExists && !needsKeyBackupDismissed}
<div class="alert-banner">
    <Icon class="material-icons-round">warning</Icon>
    <div>
        Your encryption keys are not being backed up{#if deviceCount === 1}. As you don't have any other sessions the keys will be lost when you sign out or close the browser.{/if}
    </div>
    <div>
        <Button on:click={() => keyBackupCreateDialog = true}>Setup now</Button>
        <Button on:click={() => needsKeyBackupDismissed = true} secondary>Dismiss</Button>    
    </div>
</div>
{/if}

<EncryptionKeyCreateDialog {clientManager} open={keyBackupCreateDialog} closed={() => keyBackupCreateDialogClosed()}/>

<TextfieldDialog bind:this={textfieldDialog} />

<MenuSurface bind:this={fileMenu} anchor={false} quickOpen>
    {#if selectedFile}
        <List dense>
            <Item on:SMUI:action={() => renameFile(selectedFile)}>
                <Graphic class="material-icons-round">drive_file_rename_outline</Graphic>
                <Text>Rename</Text>
            </Item>
            <Item on:SMUI:action={() => setLocked(selectedFile, !selectedFile.isLocked())}>
                <Graphic class="material-icons-round">{selectedFile.isLocked() ? 'lock_open' : 'lock'}</Graphic>
                <Text>{selectedFile.isLocked() ? 'Unlock' : 'Lock'}</Text>
            </Item>
            <Separator />
            <Item on:SMUI:action={() => downloadFile(selectedFile)}>
                <Graphic class="material-icons-round">file_download</Graphic>
                <Text>Download</Text>
            </Item>
            <Item on:SMUI:action={() => viewHistoryFile(selectedFile)}>
                <Graphic class="material-icons-round">history</Graphic>
                <Text>Version history</Text>
            </Item>
            <Separator />
            <Item on:SMUI:action={() => removeFile(selectedFile)}>
                <Graphic class="material-icons-round">delete</Graphic>
                <Text>Delete</Text>
            </Item>
            <Separator />
            <Item on:SMUI:action={() => viewSource(selectedFile)}>
                <Graphic class="material-icons-round">code_off</Graphic>
                <Text>View source</Text>
            </Item>
        </List>
    {/if}
</MenuSurface>


<MenuSurface bind:this={folderMenu} anchor={false} quickOpen>
    {#if selectedFolder}
        <List dense>
            <Item on:SMUI:action={() => renameFolder(selectedFolder)}>
                <Graphic class="material-icons-round">drive_file_rename_outline</Graphic>
                <Text>Rename</Text>
            </Item>
            <Separator />
            <Item on:SMUI:action={() => removeDir(selectedFolder)}>
                <Graphic class="material-icons-round">delete</Graphic>
                <Text>Delete</Text>
            </Item>
        </List>
    {/if}
</MenuSurface>

<DataTable style="width: 100%; border: none;">
    <Head>
        <Row class="header">
            <Cell checkbox>
                <Checkbox />
            </Cell>
            <Cell>Name</Cell>
            <Cell>Last modified</Cell>
            <Cell>File size</Cell>
        </Row>
    </Head>
    <Body>
        {#if !childrenFetchedForDirectory }
            Loading...
        {/if}
        {#each subdirectories as dir}
            <Row class="cursor-pointer" on:dblclick:preventDefault={() => router.show(`/directory/${dir.id}`)}  on:contextmenu:preventDefault={(e) => openFolderMenu(dir, e)} on:mousedown:preventDefault={() => {}}>
                <Cell checkbox>
                    <Checkbox
                        bind:group={selected}
                        value={dir}
                        valueKey={dir.id}
                    />
                </Cell>
                <Cell>
                    <div class="name-col">
                        <div>
                            <span class="material-icons-round">folder_outline</span>
                        </div>
                        <div>
                            {dir.getName()}
                        </div>
                    </div>
                </Cell>
                <Cell><EntryDate entry={dir} /></Cell>
                <Cell>-</Cell>
            </Row>
        {/each}
        {#each files as file}
            <Row class="cursor-pointer" on:dblclick:preventDefault={() => downloadFile(file)} on:contextmenu:preventDefault={(e) => openFileMenu(file, e)} on:mousedown:preventDefault={() => {}}>
                <Cell checkbox>
                    <Checkbox
                        bind:group={selected}
                        value={file}
                        valueKey={file.id}
                    />
                </Cell>
                <Cell>
                    <div class="name-col">
                        <div>
                            <span class="material-icons-round">{fileIcon(file.getName())}</span>
                        </div>
                        <div>
                            {file.getName()}
                        </div>
                        {#if file.isLocked()}
                            <div class="icon">
                                <span class="material-icons-round">lock</span>
                            </div>
                        {/if}
                    </div>
                </Cell>
                <Cell><EntryDate entry={file} lastModified /></Cell>
                <Cell>
                    <EntrySize entry={file} />
                </Cell>
            </Row>
        {/each}
    </Body>
</DataTable>

{#if subdirectories.length === 0 && files.length === 0 }
    <div class="uploadarea">
        <Icon class="material-icons-round" style="font-size: 64px">drive_folder_upload</Icon>
        <div>You can drop a file here to upload</div>
    </div>
{/if}

<Dialog
    bind:open={historyDialog}
    on:MDCDialog:closed={() => { historyDialog = false; }}
    surface$style="width: fit-content; max-width: calc(100vw - 32px);"
>
    <Title style="font-size: 24px; font-weight: 600;">Version history</Title>
    {#if versionHistory}
        <Content>
            <DataTable style="width: 100%; border: none;">
                <Head>
                    <Row class="header">
                        <Cell>Version</Cell>
                        <Cell>Name</Cell>
                        <Cell>File size</Cell>
                        <Cell>Created at</Cell>
                        <Cell>By</Cell>
                        <Cell></Cell>
                    </Row>
                </Head>
                <Body>
                    {#each versionHistory as file}
                        <Row class="cursor-pointer" on:dblclick:preventDefault={() => downloadFile(file)}>
                            <Cell title={file.id}>
                                {file.version}
                            </Cell>
                            <Cell>{file.getName()}</Cell>
                            <Cell>
                                <EntrySize entry={file} />
                            </Cell>
                            <Cell>
                                <EntryDate entry={file} lastModified />
                            </Cell>
                            <Cell>
                                <EntryCreatedBy entry={file} />
                            </Cell>
                            <Cell>
                                <IconButton on:click={() => downloadFile(file)} class="material-icons-round" variant="unelevated">download</IconButton>
                            </Cell>
                        </Row>
                    {/each}
                </Body>
            </DataTable>
        </Content>
    {/if}
    <Actions>
        <Button variant="unelevated">
            <Label>Close</Label>
        </Button>
    </Actions>
</Dialog>

<Dialog
    bind:open={viewSourceDialog}
    on:MDCDialog:closed={() => { viewSourceDialog = false; }}
    surface$style="width: fit-content; max-width: calc(100vw - 32px);"
>
    <Title style="font-size: 24px; font-weight: 600;">View source</Title>
    {#if viewSourceBranch}
        <Content>
            <p>
                Room ID: {viewSourceBranch.getParent().id}<br>
                Event ID: {viewSourceBranch.id}<br>
                Encryption status: {viewSourceBranch.getEncryptionStatus()}
            </p>
            <hr>
            <Accordion>
                <Section title={'Index event source'}>
                    {#if viewSourceBranch.branch.indexEvent}
                        <JsonView class="monospace" json={viewSourceBranch.branch.indexEvent.event} />
                    {:else}
                        Not found
                    {/if}
                </Section>
                <Section title={'Decrypted file event source'}>
                    {#if viewSourceFileEvent}
                        <JsonView class="monospace" json={viewSourceFileEvent.getClearContent()} />
                    {:else}
                        Not found
                    {/if}
                </Section>
                <Section title={'Original file event source'}>
                    {#if viewSourceFileEvent}
                        <JsonView class="monospace" json={viewSourceFileEvent.event} />
                    {:else}
                        Not found
                    {/if}
                </Section>
            </Accordion>
        </Content>
    {/if}
    <Actions>
        <Button variant="unelevated">
            <Label>Close</Label>
        </Button>
    </Actions>
</Dialog>

<style lang="scss">
    .name-col {
        display: flex;
        align-items: center;
        .material-icons-round {
            width: 24px;
            color: #C1C6CD !important;
            margin-right: 10px;
        }
        
        :first-child {
            padding-right: 4px;
        }

        .icon {
            padding-left: 4px;
        }
    }

    .uploadarea {
        width: 100%;
        min-height: 200px;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-direction: column;
    }

    :global(.mdc-data-table__header-cell) {
        font-weight: 600 !important;
        color: #000 !important;
    }
    :global(.accordion-section__header) {
    border: none !important;
        background-color: transparent !important;
        padding: 0 !important;
    }

    :global(ul.accordion) {
        padding-inline-start: 0 !important;
    }

    :global(.accordion span.bracket, .accordion ul li) {
        font-family: 'Courier New', Courier, monospace !important;
    }

    .alert-banner {
        border: solid 1px var(--mdc-theme-error);
        border-radius: 10px;
        width: -webkit-fill-available;
        display: flex;
        padding: 8px;
        margin: 12px;
        justify-content: space-between;
        align-items: center;
        color: var(--mdc-theme-error);
    }
</style>
