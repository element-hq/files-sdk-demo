<!--
Copyright 2021, 2022 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
-->

<script lang="ts">
    import type { ClientManager } from "../ClientManager";
    import Dialog, { Title, Content, Actions, InitialFocus } from '@smui/dialog';
    import Button, { Icon, Label } from '@smui/button';
    import type { MatrixFiles } from "matrix-files-sdk";
    import Textfield, { HelperLine } from "@smui/textfield";
    import CircularProgress from '@smui/circular-progress';
    import type { IKeyBackupInfo, IKeyBackupRestoreResult } from "matrix-js-sdk/lib/crypto/keybackup";
    import { onDestroy, onMount } from "svelte";
    import type { TrustInfo } from "matrix-js-sdk/lib/crypto/backup";

    export let clientManager: ClientManager;
    export let open: boolean;
    export let closed: () => void;

    let keyBackupInfo: IKeyBackupInfo | null = null;

    $: (async () => {
        keyBackupInfo = await clientManager.crypto.getKeyBackupInfo();
    })();

    let deviceCount = 1;

    $: (async () => {
        deviceCount = (await clientManager.files.client.getDevices()).devices.length;
    })();

    let useKeyBackup = false;
    let passphrase = '';
    $: {
        if (open) {
            useKeyBackup = false;
            passphrase = '';
            restoreResult = undefined;
            trustInfo = undefined;
            errorMessage = '';
        }
    };

    let keyBackupDisabled = true;
    let deviceVerificationDisabled = true;

    $: keyBackupDisabled = !keyBackupInfo || isConnectedToKeyBackup;

    let isConnectedToKeyBackup = false;

    async function keyBackupStatus(_mf: MatrixFiles, status: boolean) {
        isConnectedToKeyBackup = status;
    }

    onMount(() => {
        clientManager.on('keyBackupStatus', keyBackupStatus);
        keyBackupStatus(clientManager.files, clientManager.crypto.isConnectedToKeyBackup());
    });
    onDestroy(() => clientManager.off('keyBackupStatus', keyBackupStatus));

    let restoreResult: IKeyBackupRestoreResult | undefined;
    let trustInfo: TrustInfo | undefined;
    let errorMessage = '';

    let loading = false;
    async function enterPressed() {
        if (!keyBackupInfo) {
            return;
        }
        loading = true;
        try {
            errorMessage = '';
            restoreResult = undefined;
            trustInfo = undefined;
            const res = await clientManager.crypto.connectToExistingKeyBackup(passphrase);
            restoreResult = res.restoreResult;
            trustInfo = res.trustInfo;
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
    <Title style="font-size: 24px; font-weight: 600;">Get missing encryption keys</Title>
    <Content>
        {#if !useKeyBackup}
            <p>You are missing encryption keys for one or more files. To get access to these files you will need to share the keys with this session:</p>
            <div class="options">
                <div on:click={() => { if (!keyBackupDisabled) useKeyBackup = true; }} disabled={keyBackupDisabled || undefined}>
                    <p>Use online key backup</p>
                    <Icon class="material-icons-round foo">cloud_download</Icon>
                    <p>You can restore your keys from your online key backup if available</p>
                    {#if isConnectedToKeyBackup}
                        <p style="color: var(--mdc-theme-primary)">You are already connected to online key backup</p>
                    {:else}
                        {#if keyBackupInfo}
                            <p style="color: var(--mdc-theme-primary)">Backup available {#if keyBackupInfo.count}containing {keyBackupInfo.count} keys{/if}</p>
                        {:else}
                            <p style="color: var(--mdc-theme-error)">You don't have a key backup available</p>
                        {/if}
                    {/if}
                </div>
                <div disabled={deviceVerificationDisabled || undefined}>
                    <p>Verify this session</p>
                    <Icon class="material-icons-round foo">verified_user</Icon>
                    <p>You can verify this session from another of your sessions</p>
                    {#if deviceCount === 1}
                        <p style="color: var(--mdc-theme-error)">You don't have any other sessions that you can verify with</p>
                    {:else}
                        <p style="color: var(--mdc-theme-error)">Session verification is not yet implemented</p>
                    {/if}
                </div>    
            </div>
        {:else if !restoreResult}
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
                <HelperLine slot="helper">The is the passphrase that you chose when you setup the backup</HelperLine>
            </Textfield>
            <Button on:click={() => enterPressed()} variant="unelevated" disabled={loading || undefined}>
                Connect to backup
                {#if loading}
                    <CircularProgress indeterminate style="height: 24px; width: 24px; margin-left: 8px;" />
                {/if}
            </Button>
        {:else}
            <p>Restored {restoreResult.imported} of {restoreResult.total} key{restoreResult.total === 1 ? '' : 's'} from the backup.</p>
            {#if trustInfo && trustInfo.usable}
                <p>Your session will add encryption keys to the backup.</p>
            {:else}
                <p>However, your session is unable to add keys to the backup because it isn't trusted.</p>
            {/if}
        {/if}
    </Content>
    <Actions>
        <Button variant="unelevated">
            <Label>{restoreResult ? 'Done' : 'Cancel'}</Label>
        </Button>
    </Actions>
</Dialog>

<style lang="scss">
    .options {
        display: flex;
        flex-direction: row;
        > div {
            margin: 8px;
            padding: 8px;
            width: 50%;
            text-align: center;
            border: solid 1px;
            border-radius: 10px;
            cursor: pointer;
            &[disabled] {
                cursor: inherit;
            }
        }
        :global(i) {
            font-size: 48px !important;
        }
    }
</style>