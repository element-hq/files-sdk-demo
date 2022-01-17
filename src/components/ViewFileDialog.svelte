<!--
Copyright 2022 New Vector Ltd.

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
    import 'bytemd/dist/index.min.css';
    import 'github-markdown-css/github-markdown-light.css';
    import { Editor, Viewer } from 'bytemd';
    import gfm from '@bytemd/plugin-gfm';
    import externalLinks from '@bytemd/plugin-external-links';

    import Dialog, { Title, Content, Actions } from '@smui/dialog';
    import Button, { Label } from '@smui/button';
    import type { IFileEntry } from 'matrix-files-sdk';
    import { errorWrapper } from '../utils';
    import type { ArrayBufferBlob } from 'matrix-files-sdk/dist/utils';
    import { toasts } from 'svelte-toasts';
    import { Skeleton } from 'svelte-loading-skeleton';
    import { createObjectUrl } from '../blob';

    const plugins = [
        gfm(),
        externalLinks({ test: () => true }),
    ];

    async function closeHandler(e: CustomEvent<{ action: string }>) {
        if (e.detail.action === 'save') {
            const data = new TextEncoder().encode(markdownValue);
            
            await file.addVersion({data, size: data.length, mimetype: blob!.mimetype });
            return _resolve(true);
        }
        
        if (e.detail.action === 'download') {
            const anchor = document.createElement("a");
            anchor.href = getObjectUrl() ?? '';
            anchor.download = file.getName();
            anchor.click();
        }

        _resolve(false);
    }

    let _open = false;
    let file: IFileEntry;
    let extension: string;
    let blob: ArrayBufferBlob | undefined;
    let objectUrl: string | undefined;
    let dataUrl: string | undefined;
    let errorMessage = '';
    let _resolve: (value: boolean | PromiseLike<boolean>) => void;
    let allowEditing = false;
    let editing = false;

    function ab2str(buf: ArrayBuffer) {
        return new TextDecoder().decode(buf);
    }

    function ab2base64(blob: ArrayBufferBlob) {
        return new Promise<string> ((resolve,reject)=> {
            const reader = new FileReader();
            reader.readAsDataURL(new Blob([blob.data], { type: blob.mimetype }));
            reader.onload = () => resolve(reader.result?.toString() || '');
            reader.onerror = error => reject(error);
        });
    }

    export async function open(_file: IFileEntry): Promise<boolean> {
        _open = true;
        file = _file;
        errorMessage = '';
        objectUrl = undefined;
        dataUrl = undefined;
        allowEditing = false;
        editing = false;
        modified = false;
        markdownValue = '';
        extension = file.getName().split('.').pop()!.toLowerCase();

        await errorWrapper(async () => {
            let start: any | undefined;
            try {
                start = toasts.info(`Downloading ${file.getName()} for preview...`);
                blob = await file.getBlob();
                start.remove();
                toasts.success(`Downloaded ${file.getName()} for preview`, { duration: 4000, showProgress: true });
            } catch (err: any) {
                errorMessage = `Failed to download file: ${err.message}`;
                if (start) {
                    start.remove();
                }
                throw err;
            }
        }, `Failed to download ${file.getName()} for preview`);

        if (blob) {
            dataUrl = await ab2base64(blob);
            //`data:${blob.mimetype};base64,${btoa(blob.data)}`;
            if (blob.mimetype === 'text/markdown' || extension === 'md') {
                markdownValue = ab2str(blob.data);
                allowEditing = true;
            }
        }

        return new Promise<boolean>((resolve) => {
            _resolve = resolve;
        });
    }

    let markdownValue = '';
    let modified = false;

    function markdownChanged(e: CustomEvent<{ value: string }>) {
        if (markdownValue !== e.detail.value) {
            modified = true;
        }
        markdownValue = e.detail.value;
    }

    function sanitizeMarkdown(x: any) {
        return x;
    }

    function edit() {
        if (blob && (blob.mimetype === 'text/markdown' || extension === 'md')) {
            markdownValue = ab2str(blob.data);
        }
        editing = true;
    }

    function cancelEdit() {
        if (blob && (blob.mimetype === 'text/markdown' || extension === 'md')) {
            markdownValue = ab2str(blob.data);
        }
        editing = false;
    }

    function getObjectUrl() {
        if (!objectUrl && blob) {
            objectUrl = createObjectUrl(blob);
        }

        return objectUrl;
    }
</script>

<Dialog
    bind:open={_open}
    on:MDCDialog:closed={closeHandler}
    surface$style="width: calc(100vw - 100px); max-width: calc(100vw - 32px); height: calc(100vh - 100px);"
>
    {#if file}
        <Title style="font-size: 24px; font-weight: 600;">{file.getName()}</Title>
        <Content>
            {#if blob}
                {#if blob.mimetype.startsWith('image') || ['png', 'svg', 'jpg', 'jpeg', 'gif'].includes(extension)}
                    <img src={dataUrl} alt={file.getName()} style="max-width: 100%; max-height: 100%;">
                {:else if blob.mimetype === 'application/pdf' || extension === 'pdf'}
                    <iframe src={dataUrl} height="100%" width="100%" title={file.getName()} />
                {:else if blob.mimetype === 'text/plain' || extension === 'txt'}
                    <pre>
                        {ab2str(blob.data)}
                    </pre>
                {:else if blob.mimetype === 'text/markdown' || extension === 'md'}
                    {#if editing}
                        <Editor value={markdownValue} {plugins} sanitize={sanitizeMarkdown} on:change={markdownChanged} />
                    {:else}
                        <Viewer value={markdownValue} {plugins} sanitize={sanitizeMarkdown} />
                    {/if}
                {:else}
                    Unable to preview/open files of this type: <pre>{blob.mimetype}</pre>.
                {/if}
            {:else if errorMessage}
                <p>{errorMessage}</p>
            {:else}
                <Skeleton />
            {/if}
        </Content>
    {/if}
    <Actions>
        {#if editing}
            <Button on:click={() => cancelEdit()}  variant="outlined">
                <Label>Cancel</Label>
            </Button>
            <Button action="save" variant="unelevated" disabled={!modified}>
                <Label>Save</Label>
            </Button>
        {:else}
            {#if allowEditing}
                <Button on:click={() => edit()}  variant="outlined">
                    <Label>Edit</Label>
                </Button>
            {/if}
            <Button action="download" variant="unelevated">
                <Label>Download</Label>
            </Button>
        {/if}
    </Actions>
</Dialog>

<style lang="scss">
    :global(.bytemd) {
        height: calc(100vh - 200px);
        width: 100%;
    }
</style>
