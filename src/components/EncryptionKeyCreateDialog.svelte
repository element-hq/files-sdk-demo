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
    import type { ClientManager } from "../ClientManager";
    import Dialog, { Title, Content, Actions, InitialFocus } from '@smui/dialog';
    import Button, { Label } from '@smui/button';
    import Textfield, { HelperLine } from "@smui/textfield";
    import CircularProgress from '@smui/circular-progress';

    export let clientManager: ClientManager;
    export let open: boolean;
    export let closed: () => void;

    let passphrase = '';

    let errorMessage = '';

    let loading = false;

    let recoveryKey = '';

    $: {
        if (open) {
            passphrase = '';
            errorMessage = '';
            recoveryKey = '';
        }
    };

    async function enterPressed() {
        loading = true;
        try {
            errorMessage = '';
            recoveryKey = await clientManager.crypto.createNewKeyBackup(passphrase);
        } catch (e: any) {
            console.error(e);
            errorMessage = [e.errcode, e.message].filter(x => !!x).join(': ');
        } finally {
            loading = false;
        }
    }
</script>

<Dialog
    {open}
    on:MDCDialog:closed={closed}
    surface$style="width: fit-content; max-width: calc(100vw - 32px);"
>
    <Title style="font-size: 24px; font-weight: 600;">Setup online key backup</Title>
    <Content>
        {#if !recoveryKey}
            <p>Securely backup your encryption keys online so that you can use them in other sessions.</p>
            <p>Please enter your online key backup passphrase:</p>
            {#if errorMessage}
                <p style="color: red; text-align: center; font-weight: bold;">
                    {errorMessage}
                </p>
            {/if}
            <Textfield
                on:keyup={(e) => e.detail.key === 'Enter' && enterPressed()}
                use={[InitialFocus]}
                variant="outlined"
                type="password"
                bind:value={passphrase}
                required
                label="Passphrase"
                style="width: 100%;"
            >
                <HelperLine slot="helper">You will use this passphrase to access this backup in future</HelperLine>
            </Textfield>
            <Button on:click={() => enterPressed()} variant="unelevated" disabled={loading}>
                Create backup
                {#if loading}
                    <CircularProgress indeterminate style="height: 24px; width: 24px; margin-left: 8px;" />
                {/if}
            </Button>
        {:else}
            <p>Online backup has been setup. Your recovery key is:</p>
            <div style="white-space: pre-wrap; font-family:monospace;">{recoveryKey}</div>
        {/if}
    </Content>
    <Actions>
        <Button variant="unelevated">
            <Label>{recoveryKey ? 'Done' : 'Cancel'}</Label>
        </Button>
    </Actions>
</Dialog>

<style lang="scss">
    .options {
        display: flex;
        flex-direction: row;
        > div {
            margin: 8px;
            width: 50%;
            text-align: center;
            border: solid 1px;
            border-radius: 10px;
            &:not([disabled]) {
                cursor: pointer;
            }
        }
        :global(i) {
            font-size: 48px !important;
        }
    }
</style>