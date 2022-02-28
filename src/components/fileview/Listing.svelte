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
    import Accordion from "svelte-accordion";
    import { JsonView } from '@zerodevx/svelte-json-view'
    import EncryptionKeyRestoreDialog from "../EncryptionKeyRestoreDialog.svelte";
    import EncryptionKeyCreateDialog from '../EncryptionKeyCreateDialog.svelte';
    import ViewFileDialog from '../ViewFileDialog.svelte';
    import { createObjectUrl } from "../../blob";
    import { getLogger } from "log4js";
    import { getMimeFromFilename } from "../../mime";

    export let clientManager: ClientManager;
    export let directory: IFolderEntry;

    const log = getLogger('Listing');

    const urlsToRevoke: string[] = [];
    let childrenFetchedForDirectory: string | null = null;
    let selected: IEntry[] = [];
    let subdirectories: IFolderEntry[] = [];
    let files: IFileEntry[] = [];

    let versionHistory: IFileEntry[];

    function onModified() {
        log.info('onModified');
        childrenFetchedForDirectory = null;
    }

    log.info('loaded');

    let shadowDirectory = directory;

    onMount(() => {
        keyBackupStatus();
        shadowDirectory.on('modified', onModified);
        clientManager.on('keyBackupStatus', keyBackupStatus);
    });
    onDestroy(() => {
        urlsToRevoke.forEach(u => URL.revokeObjectURL(u));
        shadowDirectory.off('modified', onModified);
        clientManager.off('keyBackupStatus', keyBackupStatus);
    });

    let needsDecryption = false;
    let needsDecryptionDismissed = false;

    $: (async () => {
        if (!shadowDirectory || shadowDirectory?.id !== directory.id) {
            if (shadowDirectory) {
                shadowDirectory.off('modified', onModified);
            }
            shadowDirectory = directory;
            shadowDirectory.on('modified', onModified);
        }
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
        }).sort((a, b) => a.name.localeCompare(b.name));
        files = children.filter(c => !c.isFolder).map(c => c as IFileEntry).map(f => {
            let existing = currFiles.find(s => s.id === f.id);

            if (existing) {
                existing = {...existing};
            }

            return f;
        }).sort((a, b) => a.name.localeCompare(b.name));
        childrenFetchedForDirectory = directory.id;

        needsDecryption = files.some(x => ['encrypted', 'decryptionFailed'].includes(x.encryptionStatus));
    })();

    async function removeDir(dir: IFolderEntry) {
        folderMenu.setOpen(false);
        await errorWrapper(async () => {
            await dir.delete();
        }, `Failed to delete folder ${dir.name}`);
    }

    async function removeFile(file: IFileEntry) {
        fileMenu.setOpen(false);
        await errorWrapper(async () => {
            await file.delete();
        }, `Failed to delete file ${file.name}`);
    }

    let viewFileDialog: ViewFileDialog;
    let viewFileTimer: NodeJS.Timeout;

    async function viewFile(e: CustomEvent | undefined, file: IFileEntry) {
        // exclude non-single clicks:
        if (e?.detail === 1) {
            // use timeout to deduplicate double click (download file) event:
            viewFileTimer = setTimeout(async () => {
                fileMenu.setOpen(false);

                await viewFileDialog.open(file);
            }, 200);
        } else if (!e) {
            fileMenu.setOpen(false);
            await viewFileDialog.open(file);
        }
    }

    async function downloadFile(file: IFileEntry) {
        if (viewFileTimer) {
            clearTimeout(viewFileTimer);
        }
        fileMenu.setOpen(false);
        if (await errorWrapper(async () => {
            let start: any | undefined;
            try {
                start = toasts.info(`Downloading ${file.name}...`);
                const blob = await file.getBlob();
                const anchor = document.createElement("a");
                anchor.href = createObjectUrl(blob)
                anchor.download = file.name;
                anchor.click();
                start.remove();
                toasts.success(`Downloaded ${file.name}`, { duration: 4000, showProgress: true });
            } catch (err) {
                if (start) {
                    start.remove();
                }
                throw err;
            }
        }, `Failed to download ${file.name}`)) {
            needsDecryptionDismissed = false;
        }
    }

    async function setLocked(file: IFileEntry, state: boolean) {
        fileMenu.setOpen(false);
        await errorWrapper(async () => {
            await file.setLocked(state);
        }, `Failed to ${state ? '' : 'un'}lock file ${file.name}`);
        files = files;
    }

    async function viewHistoryFile(file: IFileEntry) {
        fileMenu.setOpen(false);
        if (await errorWrapper(async () => {
            versionHistory = await file.getVersionHistory();
            historyDialog = true;
        }, `Failed to get version history for ${file.name}`)) {
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

    export async function newFile() {
        const name = await textfieldDialog.open('New file', 'Untitled.md', 'File name', 'Create', itemNameValidator(undefined, subdirectories, files));
        if (name) {
            await errorWrapper(async () => {
                await directory.addFile(name, { data: new ArrayBuffer(0), size: 0, mimetype: 'text/plain' });
            }, `Failed to create file ${name}`);
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
        const name = await textfieldDialog.open('Rename file', file.name, 'File name', 'Rename', itemNameValidator(file.name, subdirectories, files));
        if (name) {
            await errorWrapper(async () => {
                await file.rename(name);
            }, `Failed to rename file ${file.name}`);
        }
    }

    async function copyFile(file: IFileEntry) {
        fileMenu.setOpen(false);
        const name = await textfieldDialog.open('Copy file', `Copy of ${file.name}`, 'File name', 'Copy', itemNameValidator(file.name, subdirectories, files));
        if (name) {
            await errorWrapper(async () => {
                await file.copyTo(file.parent!, name);
            }, `Failed to copy file ${file.name}`);
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
        const name = await textfieldDialog.open('Rename folder', folder.name, 'Folder name', 'Rename', itemNameValidator(folder.name, subdirectories, files));
        if (name) {
            await errorWrapper(async () => {
                await folder.rename(name);
            }, `Failed to rename folder ${folder.name}`);
        }
    }

    async function copyFolder(folder: IFolderEntry) {
        folderMenu.setOpen(false);
        const name = await textfieldDialog.open('Copy folder', `Copy of ${folder.name}`, 'Folder name', 'Copy', itemNameValidator(folder.name, subdirectories, files));
        if (name) {
            await errorWrapper(async () => {
                await folder.copyTo(folder.parent!, name);
            }, `Failed to copy folder ${folder.name}`);
        }
    }

    export async function uploadFiles(newFiles: File[]) {
        for (const file of newFiles) {
            await errorWrapper(async () => {
                // if existing file then upload as new version
                const start = toasts.info(`Uploading ${file.name}...`);
                await directory.addFile(file.name, { data: await file.arrayBuffer(), mimetype: file.type || getMimeFromFilename(file.name), size: file.size });
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
        }, `Failed to get version history for ${file.name}`)) {
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

<ViewFileDialog bind:this={viewFileDialog} />

<TextfieldDialog bind:this={textfieldDialog} />

<MenuSurface bind:this={fileMenu} anchor={false} quickOpen>
    {#if selectedFile}
        <List dense>
            <Item on:SMUI:action={(e) => viewFile(undefined, selectedFile)}>
                <Graphic class="material-icons-round">file_open</Graphic>
                <Text>Preview</Text>
            </Item>
            <Item on:SMUI:action={() => downloadFile(selectedFile)}>
                <Graphic class="material-icons-round">file_download</Graphic>
                <Text>Download</Text>
            </Item>
            <Item on:SMUI:action={() => viewHistoryFile(selectedFile)}>
                <Graphic class="material-icons-round">history</Graphic>
                <Text>Version history</Text>
            </Item>
            <Separator />
            <Item on:SMUI:action={() => renameFile(selectedFile)}>
                <Graphic class="material-icons-round">drive_file_rename_outline</Graphic>
                <Text>Rename</Text>
            </Item>
            <Item on:SMUI:action={() => copyFile(selectedFile)}>
                <Graphic class="material-icons-round">file_copy</Graphic>
                <Text>Make a copy</Text>
            </Item>
            <Item on:SMUI:action={() => setLocked(selectedFile, !selectedFile.locked)}>
                <Graphic class="material-icons-round">{selectedFile.locked ? 'lock_open' : 'lock'}</Graphic>
                <Text>{selectedFile.locked ? 'Unlock' : 'Lock'}</Text>
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
            <Item on:SMUI:action={() => copyFolder(selectedFolder)}>
                <Graphic class="material-icons-round">content_copy</Graphic>
                <Text>Make a copy</Text>
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
            <Row class="cursor-pointer" on:dblclick:preventDefault={() => router.show(`/directory/${dir.id}`)} on:contextmenu:preventDefault={(e) => openFolderMenu(dir, e)} on:mousedown:preventDefault={() => {}}>
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
                            {dir.name}
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
                <Cell on:click:preventDefault={(e) => viewFile(e, file)}>
                    <div class="name-col">
                        <div>
                            <span class="material-icons-round">{fileIcon(file.name)}</span>
                        </div>
                        <div>
                            {file.name}
                        </div>
                        {#if file.locked}
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
                            <Cell>{file.name}</Cell>
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
                Room ID: {viewSourceBranch.parent.id}<br>
                Event ID: {viewSourceBranch.id}<br>
                Encryption status: {viewSourceBranch.encryptionStatus}
            </p>
            <hr>
            <Accordion>
                <Accordion.Section title={'Index event source'}>
                    {#if viewSourceBranch.branch.indexEvent}
                        <JsonView class="monospace" json={viewSourceBranch.branch.indexEvent.event} />
                    {:else}
                        Not found
                    {/if}
                </Accordion.Section>
                <Accordion.Section title={'Decrypted file event source'}>
                    {#if viewSourceFileEvent}
                        <JsonView class="monospace" json={viewSourceFileEvent.getClearContent()} />
                    {:else}
                        Not found
                    {/if}
                </Accordion.Section>
                <Accordion.Section title={'Original file event source'}>
                    {#if viewSourceFileEvent}
                        <JsonView class="monospace" json={viewSourceFileEvent.event} />
                    {:else}
                        Not found
                    {/if}
                </Accordion.Section>
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
